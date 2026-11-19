/**
 * Geração do Agente de Carrossel.
 *
 *   perfil + pedido ─▶ plano (GPT: textos, guia de estilo, legenda)
 *                    ─▶ capa (GPT Image, refs do perfil)
 *                    ─▶ demais cards em paralelo (GPT Image, capa como Imagem 1)
 *                    ─▶ cada card: 1080×1350 + logo colada + JPEG ─▶ revisão do texto
 *                       (modelo de visão; refaz 1x se achar erro)
 *                    ─▶ "Aguardando aprovação"
 *
 * Roda dentro de `after()` (maxDuration da rota). O estado fica em memória e é
 * gravado inteiro a cada card, numa fila (sem corrida entre cards paralelos).
 * Cada execução tem um `generation_id`: se outra começar (ex.: "refazer card"),
 * as escritas da antiga param. Se a função morrer no meio, "Retomar" continua
 * só os cards que não ficaram prontos.
 */

import { randomUUID } from "crypto";
import pLimit from "p-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import type { CarouselProfile } from "@/types/carousel-profile";
import { z } from "zod";
import { openaiStructured } from "@/lib/ai/openai-text";
import { stripTravessao } from "@/lib/text/strip-dash";
import { designProfileToTweetProfile } from "@/types/tweet-carousel";
import { generateOpenAIImage, type OpenAIImageQuality } from "@/lib/ai/imagegen/openai";
import { INSTAGRAM_POSTS_BUCKET } from "@/lib/instagram/posts";
import { buildCaption, buildCardPrompt, buildPlanInput, buildPlanSystemPrompt, expectedTexts } from "./prompts";
import { reviewCardText } from "./qa";
import { downloadImage, finalizeCard } from "./images";
import { renderTweetCard } from "./tweet-render";
import { getRun, notifyAgent, toAgentRun, type Admin } from "./runs";
import { agentPlanSchema, AGENT_MAX_CARDS, AGENT_MIN_CARDS, type AgentCard, type AgentPlan, type AgentRun } from "./types";

/** Tentativas por card (a 2ª só quando a revisão acha erro ou a geração falha). */
const MAX_ATTEMPTS = 2;
/**
 * Todos os cards depois da capa de uma vez: a capa leva ~100s e cada card
 * ~80s, então em lotes um carrossel de 8 passaria do teto de 300s da função.
 */
const PARALLEL_CARDS = AGENT_MAX_CARDS - 1;
const MAX_PROFILE_REFERENCES = 3;

function imageQuality(): OpenAIImageQuality {
  const q = process.env.CAROUSEL_AGENT_IMAGE_QUALITY?.trim().toLowerCase();
  return q === "low" || q === "medium" || q === "high" ? q : "high";
}

function emptyCard(index: number): AgentCard {
  return { index, status: "pending", url: null, path: null, prompt: null, attempts: 0, qa: null, error: null };
}

/**
 * Reivindica o carrossel para uma geração nova. Devolve null se ele não está
 * num estado que permite gerar (ex.: já aprovado).
 */
async function claim(admin: Admin, runId: string): Promise<{ run: AgentRun; generationId: string } | null> {
  const generationId = randomUUID();
  const { data } = await admin
    .from("carousel_agent_runs")
    .update({
      status: "generating",
      generation_id: generationId,
      generation_started_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", runId)
    .in("status", ["queued", "generating", "awaiting_approval", "failed"])
    .select("*")
    .maybeSingle();
  return data ? { run: toAgentRun(data), generationId } : null;
}

async function makePlan(profile: CarouselProfile, run: AgentRun): Promise<AgentPlan> {
  const plan = await openaiStructured({
    system: buildPlanSystemPrompt(profile, run.mode, run.format === "single" ? 1 : run.card_count, run.format),
    input: buildPlanInput(run.mode, run.input, run.format),
    schemaName: "carousel_plan",
    schema: agentPlanSchema,
    reasoningEffort: "medium",
    maxOutputTokens: 12_000,
    timeoutMs: 120_000,
  });
  let cards = plan.cards.filter((c) => c.texts.some((t) => t.trim()) || c.cta?.trim());
  if (run.format === "tweet") {
    // Card tweet = um texto só; sem CTA desenhado nem guia visual.
    cards = cards.map((c) => ({
      texts: [c.texts.map((t) => t.trim()).filter(Boolean).join("\n\n")],
      cta: null,
      visual: "",
    }));
  }
  if (run.format === "single") {
    if (!cards.length) throw new Error("A IA não montou a arte. Tente de novo.");
    return { ...plan, cards: cards.slice(0, 1) };
  }
  if (cards.length < AGENT_MIN_CARDS) throw new Error("A IA não montou cards suficientes. Tente de novo.");
  return { ...plan, cards: cards.slice(0, AGENT_MAX_CARDS) };
}

/** Texto do card tweet sem travessão, parágrafo por parágrafo. */
function cleanTweetText(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.trim() ? stripTravessao(line) : ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "Refazer" de um card tweet: a IA reescreve só aquele card. */
async function rewriteTweetCard(plan: AgentPlan, index: number, instruction: string | null): Promise<string> {
  const current = plan.cards[index].texts[0] ?? "";
  const neighbors = plan.cards
    .map((c, i) => `Card ${i + 1}${i === index ? " (ESTE)" : ""}: ${c.texts[0] ?? ""}`)
    .join("\n\n");
  const out = await openaiStructured({
    system: `Você reescreve UM card de um carrossel "print de tweet" de Instagram. Mantenha o tom e a continuidade com os outros cards. De 120 a 320 caracteres (máx. 420), parágrafos separados por \\n\\n, no máximo 1 trecho em **negrito**, sem hashtags, sem travessão. Português do Brasil.`,
    input: `Carrossel:\n${neighbors}\n\nCard atual (${index + 1}):\n${current}\n\n${
      instruction?.trim() ? `Pedido de ajuste: ${instruction.trim()}` : "Escreva uma versão melhor deste card."
    }`,
    schemaName: "tweet_card",
    schema: z.object({ text: z.string() }),
    reasoningEffort: "low",
    maxOutputTokens: 3000,
    timeoutMs: 60_000,
  });
  return cleanTweetText(out.text) || current;
}

export type GenerationOptions = {
  /** Só estes cards (refazer). Sem isso: todos os que não estão prontos. */
  onlyIndexes?: number[];
  /** Instrução para os cards de `onlyIndexes`. */
  instruction?: string | null;
};

/** Roda (ou continua) a geração. Nunca lança: erro vira status `failed`. */
export async function runGeneration(runId: string, opts: GenerationOptions = {}): Promise<void> {
  const admin = createAdminClient();
  const claimed = await claim(admin, runId);
  if (!claimed) return;
  const { generationId } = claimed;
  let run = claimed.run;
  // Refazer card de um carrossel que já estava pronto: o agente já foi avisado.
  const wasAwaiting = !!run.plan && run.cards.length > 0 && run.cards.every((c) => c.status === "ready");

  // ── Persistência em fila: grava o estado inteiro, só se a geração ainda é esta.
  let chain: Promise<unknown> = Promise.resolve();
  let fenced = false;
  const save = (patch: Record<string, unknown> = {}) => {
    chain = chain.then(async () => {
      if (fenced) return;
      const { data } = await admin
        .from("carousel_agent_runs")
        .update({ cards: run.cards as unknown as Json, ...patch })
        .eq("id", runId)
        .eq("generation_id", generationId)
        .select("id");
      if (!data?.length) fenced = true;
    });
    return chain;
  };

  try {
    const { data: profileRow } = run.profile_id
      ? await admin.from("carousel_profiles").select("*").eq("id", run.profile_id).maybeSingle()
      : { data: null };
    const profile = profileRow as CarouselProfile | null;
    if (!profile) throw new Error("O perfil de design deste carrossel foi excluído.");

    // 1. Plano
    if (!run.plan) {
      const plan = await makePlan(profile, run);
      run = { ...run, plan, caption: buildCaption(plan), cards: plan.cards.map((_, i) => emptyCard(i)) };
      await save({ plan: plan as unknown as Json, caption: run.caption });
    }
    const plan = run.plan!;
    if (run.cards.length !== plan.cards.length) {
      run.cards = plan.cards.map((_, i) => run.cards[i] ?? emptyCard(i));
    }

    const todo = (opts.onlyIndexes?.length
      ? opts.onlyIndexes.filter((i) => i >= 0 && i < plan.cards.length)
      : run.cards.filter((c) => c.status !== "ready").map((c) => c.index)
    ).sort((a, b) => a - b);

    for (const i of todo) {
      run.cards[i] = {
        ...run.cards[i],
        status: "pending",
        error: null,
        attempts: 0,
        instruction: opts.onlyIndexes ? opts.instruction ?? null : run.cards[i].instruction ?? null,
      };
    }
    await save();

    const isTweet = run.format === "tweet";
    const tweetProfile = designProfileToTweetProfile(profile);
    const theme = run.options.theme === "dark" ? "dark" : "light";
    const avatar =
      isTweet && tweetProfile.avatar_url ? await downloadImage(tweetProfile.avatar_url).catch(() => null) : null;
    const logo = !isTweet && profile.logo_url ? await downloadImage(profile.logo_url).catch(() => null) : null;
    const profileRefs = (profile.reference_images ?? [])
      .slice(0, MAX_PROFILE_REFERENCES)
      .map((r) => ({ url: r.url }));

    const uploadCard = async (index: number, jpeg: Buffer) => {
      const path = `agent/${run.id}/card-${String(index + 1).padStart(2, "0")}-${Date.now()}.jpg`;
      const { error: upErr } = await admin.storage
        .from(INSTAGRAM_POSTS_BUCKET)
        .upload(path, jpeg, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error(`Falha ao salvar o card: ${upErr.message}`);
      const url = admin.storage.from(INSTAGRAM_POSTS_BUCKET).getPublicUrl(path).data.publicUrl;
      // A versão anterior do card (tentativa ou "refazer") não serve mais.
      const oldPath = run.cards[index].path;
      if (oldPath && oldPath !== path) {
        await admin.storage.from(INSTAGRAM_POSTS_BUCKET).remove([oldPath]).catch(() => null);
      }
      return { url, path };
    };

    // Tweet: texto exato desenhado em código (sem modelo de imagem, sem revisão).
    const generateTweetCard = async (index: number) => {
      if (fenced) return;
      run.cards[index] = { ...run.cards[index], status: "generating", attempts: run.cards[index].attempts + 1 };
      await save();
      try {
        if (opts.onlyIndexes?.includes(index)) {
          const text = await rewriteTweetCard(plan, index, run.cards[index].instruction ?? null);
          plan.cards[index] = { ...plan.cards[index], texts: [text] };
          await save({ plan: plan as unknown as Json });
        }
        const png = await renderTweetCard({
          text: cleanTweetText(plan.cards[index].texts[0] ?? ""),
          name: tweetProfile.name,
          handle: tweetProfile.handle,
          avatar,
          theme,
        });
        const { url, path } = await uploadCard(index, await finalizeCard(png, null));
        run.cards[index] = { ...run.cards[index], status: "ready", url, path, prompt: null, qa: null, error: null };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Erro ao desenhar o card";
        console.error(`[carousel-agent] card tweet ${index + 1}`, message);
        run.cards[index] = { ...run.cards[index], status: run.cards[index].url ? "ready" : "failed", error: message };
      }
      await save();
    };

    const generateCard = async (index: number) => {
      if (fenced) return;
      if (isTweet) return generateTweetCard(index);
      const cover = index > 0 && run.format === "carousel" ? run.cards[0] : null;
      const coverRef = cover?.status === "ready" && cover.url ? [{ url: cover.url }] : [];
      let issues: string[] = [];
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (fenced) return;
        const prompt = buildCardPrompt({
          plan,
          index,
          format: run.format,
          hasLogo: !!logo,
          coverAsReference: coverRef.length > 0,
          profileReferenceCount: profileRefs.length,
          previousIssues: issues,
          instruction: run.cards[index].instruction,
        });
        run.cards[index] = { ...run.cards[index], status: "generating", prompt, attempts: attempt };
        await save();
        try {
          const { buffer } = await generateOpenAIImage({
            prompt,
            references: [...coverRef, ...profileRefs],
            referencesInPrompt: true,
            aspectRatio: "4:5",
            resolution: "2K",
            quality: imageQuality(),
          });
          const { url, path } = await uploadCard(index, await finalizeCard(buffer, logo));

          const qa = await reviewCardText(url, expectedTexts(plan, index)).catch((e) => {
            console.warn("[carousel-agent] revisão falhou", e instanceof Error ? e.message : e);
            return null;
          });
          run.cards[index] = { ...run.cards[index], status: "ready", url, path, qa, error: null };
          await save();
          if (!qa || qa.ok) return;
          issues = qa.issues;
        } catch (e) {
          const message = e instanceof Error ? e.message : "Erro ao gerar a imagem";
          console.error(`[carousel-agent] card ${index + 1} tentativa ${attempt}`, message);
          // Se uma tentativa anterior já deixou o card pronto, ele fica como está.
          if (run.cards[index].url && attempt > 1) {
            run.cards[index] = { ...run.cards[index], status: "ready" };
            await save();
            return;
          }
          run.cards[index] = { ...run.cards[index], status: attempt < MAX_ATTEMPTS ? "generating" : "failed", error: message };
          await save();
        }
      }
    };

    // 2. Carrossel em imagem: capa primeiro (referência de estilo dos outros),
    //    depois o resto em paralelo. Tweet e arte única não dependem da capa.
    if (todo.includes(0)) await generateCard(0);
    if (run.cards[0].status !== "ready") throw new Error(run.cards[0].error ?? "Não foi possível gerar a capa.");
    const limit = pLimit(PARALLEL_CARDS);
    await Promise.all(todo.filter((i) => i !== 0).map((i) => limit(() => generateCard(i))));

    if (fenced) return;
    const failed = run.cards.filter((c) => c.status !== "ready");
    if (failed.length) {
      throw new Error(
        `${failed.length} card(s) não foram gerados (${failed.map((c) => c.index + 1).join(", ")}): ${failed[0].error ?? "erro"}`
      );
    }
    await save({ status: "awaiting_approval", error: null });
    await chain;
    if (!fenced && !wasAwaiting) {
      const fresh = await getRun(admin, runId);
      if (fresh) await notifyAgent(fresh, "awaiting_approval");
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro na geração";
    console.error("[carousel-agent] geração falhou", runId, message);
    await save({ status: "failed", error: message });
    await chain;
    if (!fenced) {
      const fresh = await getRun(admin, runId);
      if (fresh) await notifyAgent(fresh, "failed");
    }
  }
}

export { isStale, STALE_GENERATION_MS } from "./shape";
