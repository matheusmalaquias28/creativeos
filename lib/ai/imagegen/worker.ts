/**
 * Worker de geração em lote com concorrência limitada.
 * Processa jobs com status 'queued' da tabela art_generation_job.
 *
 * A curadoria gera SEMPRE pelo Gemini, direto — `params.model` é ignorado
 * (nada de Magnific aqui). Por job:
 *   1. monta o prompt: referências → briefing do diretor → padrões fixos;
 *   2. gera no Gemini;
 *   3. compõe a logo real (sem fundo, contraste garantido, topo central);
 *   4. revisão automática com visão; se reprovar, UMA nova tentativa com as
 *      correções anexadas ao prompt (fica a melhor das duas);
 *   5. salva a arte final (v1.png) e a versão sem logo (v1_raw.png), usada
 *      pelos ajustes para recompor a logo sem duplicá-la.
 *
 * Timeout: IMAGE_JOB_TIMEOUT_MS (padrão 4min — cobre duas gerações + revisões).
 * Cancelamento: ao marcar o job como 'failed' externamente, o worker respeita.
 */

import pLimit from "p-limit";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateArt, type ImageSize, type AspectRatio } from "./client";
import { urlsToInlineDataParts, urlToInlineDataPart } from "./storage-refs";
import { compositeBrandLogo, prepareLogo } from "./brand-logo";
import { compilePrompt } from "./prompt-compiler";
import {
  appendTechnicalBlock,
  buildStandardsBlock,
  LOGO_ZONE_BAND,
  type TechnicalBlockSpec,
} from "@/lib/ai/art-director/technical-block";
import { reviewArt, type ArtReview } from "@/lib/ai/art-director/review-art";
import { ART_ASPECT_RATIO } from "@/lib/ai/art-director/constants";
import type { DirectionMeta, ReferenceRole } from "@/lib/ai/art-director/types";
import { IMAGE_GEN_DEFAULTS } from "./defaults";
import type { LogoPlacement } from "./logo-composite";
import type { CreativeProfile, ArtSpec, BriefingCopy, DemandReference } from "./prompt-compiler";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MAX_CONCURRENCY = Number(process.env.IMAGE_MAX_CONCURRENCY ?? "5");
const JOB_TIMEOUT_MS = Number(process.env.IMAGE_JOB_TIMEOUT_MS ?? String(4 * 60 * 1000)); // 4min
/** Revisão automática com visão. Desligue com ART_REVIEW_ENABLED=0. */
const REVIEW_ENABLED = process.env.ART_REVIEW_ENABLED !== "0";
/** Gerações por job, contando a primeira (1 = sem nova tentativa). */
const MAX_ATTEMPTS = Math.max(1, Number(process.env.ART_REVIEW_MAX_ATTEMPTS ?? "2"));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JobRow = {
  id: string;
  demand_id: string;
  client_id: string | null;
  art_index: number;
  /** Prompt escrito pelo diretor de arte (null no fluxo legado). */
  prompt_draft?: string | null;
  /** Edição do operador sobre o rascunho. Vence o rascunho quando existe. */
  prompt_edited?: string | null;
  direction?: DirectionMeta | null;
  params: {
    headline?: string | null;
    subheadline?: string | null;
    cta?: string | null;
    informacoesExtras?: string | null;
    aspect_ratio?: string;
    image_size?: string;
    model?: string;
    quality?: "low" | "medium" | "high";
    briefing_titulo?: string | null;
    briefing_tipo?: string | null;
    extra_reference_urls?: string[] | null;
    flow_logo_url?: string | null;
    flow_references?: { url: string; role: string | null }[] | null;
  };
};

type ProfileRow = {
  base_prompt: string;
  palette: string[];
  style_reference_urls: string[];
  logo_url: string | null;
  logo_mode: string;
  logo_placement: LogoPlacement;
  image_size: string;
  aspect_ratio: string;
};

type DemandRefRow = {
  storage_url: string;
  role: string | null;
  position: number;
};

/** Referência resolvida pela camada de direção de arte — fonte única da ordem. */
type DirectedRefRow = {
  storage_url: string;
  role: ReferenceRole;
  intent: string | null;
  position: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout após ${ms / 1000}s: ${label}`));
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

// ---------------------------------------------------------------------------
// uploadArtToStorage
// ---------------------------------------------------------------------------

async function uploadArtToStorage(params: {
  buffer: Buffer;
  jobId: string;
  versionNumber: number;
  /** Versão sem logo (insumo dos ajustes). */
  raw?: boolean;
}): Promise<{ publicUrl: string; storagePath: string }> {
  const supabase = createAdminClient();
  const { buffer, jobId, versionNumber, raw } = params;
  const mimeType = "image/png";
  const storagePath = `${jobId}/v${versionNumber}${raw ? "_raw" : ""}.png`;

  const { error } = await supabase.storage
    .from("art-generations")
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from("art-generations").getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl, storagePath };
}

// ---------------------------------------------------------------------------
// processJob — processa um único job (com timeout)
// ---------------------------------------------------------------------------

async function processJob(job: JobRow): Promise<void> {
  const supabase = createAdminClient();

  // Verifica se o job ainda está queued (pode ter sido cancelado externamente)
  const { data: current } = await supabase
    .from("art_generation_job")
    .select("status")
    .eq("id", job.id)
    .single();

  if (!current || current.status !== "queued") return;

  // Marca como processing
  await supabase
    .from("art_generation_job")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", job.id);

  try {
    await withTimeout(runJob(job, supabase), JOB_TIMEOUT_MS, `job ${job.id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    const { data: jobState } = await supabase
      .from("art_generation_job")
      .select("attempts, status")
      .eq("id", job.id)
      .single();

    // Não sobrescreve se o job foi cancelado manualmente (status=failed já)
    if (jobState?.status === "processing") {
      await supabase
        .from("art_generation_job")
        .update({
          status: "failed",
          error: message,
          attempts: (jobState?.attempts ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
  }
}

async function runJob(
  job: JobRow,
  supabase: ReturnType<typeof createAdminClient>
): Promise<void> {
  // Carrega perfil criativo do cliente
  const { data: profileData, error: profileError } = await supabase
    .from("client_creative_profile")
    .select("*")
    .eq("client_id", job.client_id!)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  const profile = profileData as ProfileRow | null;

  // Carrega referências pontuais da demanda (ordenadas por position)
  const { data: demandRefRows } = await supabase
    .from("demand_reference_image")
    .select("storage_url, role, position")
    .eq("demand_id", job.demand_id)
    .order("position", { ascending: true });

  const demandRefs: DemandReference[] = (demandRefRows ?? []).map((r: DemandRefRow) => ({
    url: r.storage_url,
    role: r.role,
  }));

  // Referências escolhidas pelo diretor de arte, já ordenadas. Quando existem,
  // elas são a ordem canônica — não há espelhamento com buildOrderedRefs.
  const { data: directedRefRows } = await supabase
    .from("art_job_reference")
    .select("storage_url, role, intent, position")
    .eq("job_id", job.id)
    .order("position", { ascending: true });

  const directedRefs = (directedRefRows ?? []) as DirectedRefRow[];
  const approvedPrompt = (job.prompt_edited ?? job.prompt_draft)?.trim() || null;

  const flowRefs = job.params.flow_references ?? [];
  const flowLogoUrl = job.params.flow_logo_url ?? null;
  const usesFlowGraph = flowRefs.length > 0 || Boolean(flowLogoUrl);

  // Extra references resolved from legacy @(name) token path (non-flow queue)
  const extraRefs: DemandReference[] = (job.params.extra_reference_urls ?? []).map(
    (url) => ({
      url,
      role: "referência visual adicional indicada no prompt",
    })
  );

  const flowDemandRefs: DemandReference[] = flowRefs.map((ref) => ({
    url: ref.url,
    role: ref.role,
  }));

  const allDemandRefs = usesFlowGraph
    ? [...flowDemandRefs, ...demandRefs]
    : [...demandRefs, ...extraRefs];

  const artSpec: ArtSpec = {
    headline: job.params.headline,
    subheadline: job.params.subheadline,
    cta: job.params.cta,
    informacoesExtras: job.params.informacoesExtras,
    // Camada de direção de arte: 3:4 SEMPRE, seja qual for o perfil ou o que
    // veio na arte do Make. O fluxo legado mantém a resolução antiga.
    aspect_ratio: approvedPrompt
      ? ART_ASPECT_RATIO
      : job.params.aspect_ratio ?? profile?.aspect_ratio ?? IMAGE_GEN_DEFAULTS.aspectRatio,
    image_size: job.params.image_size ?? profile?.image_size ?? IMAGE_GEN_DEFAULTS.imageSize,
  };

  const briefing: BriefingCopy = {
    titulo: job.params.briefing_titulo,
    tipo: job.params.briefing_tipo,
  };

  const creativeProfile: CreativeProfile = {
    base_prompt: profile?.base_prompt ?? "",
    palette: (profile?.palette as string[]) ?? [],
    logo_mode: (profile?.logo_mode as "reference" | "composite") ?? "composite",
    style_reference_urls: usesFlowGraph
      ? []
      : ((profile?.style_reference_urls as string[]) ?? []),
  };

  const effectiveLogoUrl = flowLogoUrl ?? profile?.logo_url ?? null;

  const textSpec: TechnicalBlockSpec = {
    headline: artSpec.headline,
    subheadline: artSpec.subheadline,
    cta: artSpec.cta,
    informacoesExtras: artSpec.informacoesExtras,
    aspectRatio: artSpec.aspect_ratio,
    imageSize: artSpec.image_size,
  };

  // Referências enviadas ao Gemini. A logo nunca entra: ela é composta depois.
  const styleRefs = directedRefs.filter((r) => r.role !== "logo");
  const refUrls = approvedPrompt
    ? styleRefs.map((r) => r.storage_url)
    : [...creativeProfile.style_reference_urls, ...allDemandRefs.map((r) => r.url)];

  const buildPrompt = (fixNotes?: string[]): string => {
    if (approvedPrompt) {
      // Camada de direção de arte: o briefing aprovado carrega o design,
      // o bloco técnico impõe os padrões de produto.
      return appendTechnicalBlock(
        approvedPrompt,
        textSpec,
        styleRefs.map((r) => ({ role: r.role, intent: r.intent })),
        fixNotes
      );
    }
    // Sem diretor (canvas de fluxo): prompt compilado + os mesmos padrões.
    const parts = [
      compilePrompt(creativeProfile, briefing, artSpec, allDemandRefs),
      buildStandardsBlock(textSpec),
    ];
    if (fixNotes?.length) {
      parts.push(
        ["A PREVIOUS ATTEMPT FAILED REVIEW. Fix all of these:", ...fixNotes.map((n) => `- ${n}`)].join("\n")
      );
    }
    return parts.join("\n\n");
  };

  const references = await urlsToInlineDataParts(refUrls);
  const cleanLogo = effectiveLogoUrl
    ? await prepareLogo(
        Buffer.from((await urlToInlineDataPart(effectiveLogoUrl)).inlineData.data, "base64")
      )
    : null;

  type Candidate = { raw: Buffer; final: Buffer; prompt: string; review: ArtReview | null };
  let best: Candidate | null = null;
  let fixNotes: string[] | undefined;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    const prompt = buildPrompt(fixNotes);

    const generated = await generateArt({
      prompt,
      references,
      imageSize: (artSpec.image_size as ImageSize) ?? "2K",
      aspectRatio: (artSpec.aspect_ratio as AspectRatio) ?? IMAGE_GEN_DEFAULTS.aspectRatio,
    });
    const raw = await sharp(Buffer.from(generated.base64, "base64")).png().toBuffer();
    const logoResult = cleanLogo
      ? await compositeBrandLogo({ art: raw, logo: cleanLogo, palette: creativeProfile.palette })
      : null;
    const final = logoResult?.buffer ?? raw;

    let review: ArtReview | null = null;
    if (REVIEW_ENABLED) {
      try {
        review = await reviewArt({ image: final, spec: textSpec });
      } catch (err) {
        // Revisão é filtro de qualidade: se falhar, a arte segue para a curadoria.
        console.warn("[worker] revisão falhou:", (err as Error)?.message ?? err);
      }
    }

    // Checagem objetiva: logo atravessando borda/objeto reprova mesmo que a
    // revisão visual tenha passado.
    if (logoResult && !logoResult.backgroundOk) {
      review = {
        pass: false,
        score: Math.min(review?.score ?? 6, 6),
        fixes: [
          ...(review?.fixes ?? []),
          `The top band from 0% to ${Math.round(LOGO_ZONE_BAND.to * 100)}% of the height, across the middle 60% of the width, must be ONE uniform calm background area — move any edge, colour block, photo border, paper, tape, object or text out of it.`,
        ],
      };
    }

    if (!best || (review?.score ?? 0) > (best.review?.score ?? 0)) {
      best = { raw, final, prompt, review };
    }

    if (!review || review.pass) break;
    fixNotes = review.fixes;
  }

  if (!best) throw new Error("Nenhuma arte gerada");
  const promptFinal = best.prompt;

  // Upload ao Storage — final (com logo) e raw (sem logo, insumo dos ajustes).
  const { publicUrl, storagePath } = await uploadArtToStorage({
    buffer: best.final,
    jobId: job.id,
    versionNumber: 1,
  });
  await uploadArtToStorage({ buffer: best.raw, jobId: job.id, versionNumber: 1, raw: true }).catch(
    (err) => console.warn("[worker] upload da versão sem logo falhou:", (err as Error)?.message ?? err)
  );

  if (job.direction && best.review) {
    const direction: DirectionMeta = {
      ...job.direction,
      review: {
        pass: best.review.pass,
        score: best.review.score,
        attempts,
        fixes: best.review.fixes,
      },
    };
    await supabase.from("art_generation_job").update({ direction }).eq("id", job.id);
  }

  // Registra na Galeria (não-fatal)
  await supabase.from("generated_images").insert({
    source: "artes",
    prompt: artSpec.headline ?? briefing.titulo ?? "",
    aspect_ratio: artSpec.aspect_ratio ?? "1:1",
    resolution: artSpec.image_size ?? "2K",
    storage_path: storagePath,
    url: publicUrl,
  }).then(({ error }) => {
    if (error) console.error("[worker] galeria insert falhou:", error.message);
  });

  // Cria art_version v1
  const { error: versionError } = await supabase.from("art_version").insert({
    job_id: job.id,
    version_number: 1,
    result_url: publicUrl,
    storage_path: storagePath,
    instruction: null,
    is_current: true,
  });

  if (versionError) throw new Error(versionError.message);

  // Marca job como succeeded
  await supabase
    .from("art_generation_job")
    .update({
      status: "succeeded",
      prompt_final: promptFinal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
}

// ---------------------------------------------------------------------------
// runWorker — entry point
// ---------------------------------------------------------------------------

export async function runWorker(demandId?: string): Promise<{ processed: number }> {
  const supabase = createAdminClient();

  let query = supabase
    .from("art_generation_job")
    .select("id, demand_id, client_id, art_index, params, prompt_draft, prompt_edited, direction")
    .eq("status", "queued")
    .order("created_at", { ascending: true });

  if (demandId) query = query.eq("demand_id", demandId);

  const { data: jobs, error } = await query;
  if (error) throw new Error(`Worker query failed: ${error.message}`);
  if (!jobs || jobs.length === 0) return { processed: 0 };

  const limit = pLimit(MAX_CONCURRENCY);
  await Promise.all((jobs as JobRow[]).map((job) => limit(() => processJob(job))));

  return { processed: jobs.length };
}
