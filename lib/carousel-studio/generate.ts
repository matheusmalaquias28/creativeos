/**
 * Geração automática de um carrossel do Studio.
 *
 *   ficha do cliente ─┐
 *   briefing (artes) ─┼─▶ diretor de arte (IA) ─▶ layout em código ─▶ imagens (IA, em paralelo)
 *   referências ──────┘
 *
 * Roda dentro de `after()` (function com maxDuration = 300). O documento é
 * salvo assim que o layout fica pronto — o editor já mostra textos e formas —
 * e cada imagem entra no documento ao terminar. O progresso vai em
 * `generation` e chega ao front via Realtime.
 *
 * Cada execução tem um `runId`; se outra geração começar no meio (o operador
 * clicou "gerar de novo"), as escritas da antiga param.
 */

import { randomUUID } from "crypto";
import pLimit from "p-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import type { DemandArte, DemandBriefing } from "@/types/demand";
import {
  isStudioFormat,
  type StudioDocument,
  type StudioGeneration,
  type StudioImageLayer,
} from "@/types/carousel-studio";
import { loadStudioBrandKit } from "./brand-kit";
import { directCarousel } from "./director";
import { buildStudioDocument, type StudioImageJob } from "./layouts";
import { generateStudioImage } from "./images";

const IMAGE_CONCURRENCY = Number(process.env.CAROUSEL_STUDIO_IMAGE_CONCURRENCY) || 3;
/** Teto de tempo da execução inteira (a function morre em 300s). */
const RUN_BUDGET_MS = 280_000;
/** Uma geração "generating" sem notícia há mais que isso é considerada morta. */
export const STALE_GENERATION_MS = 7 * 60_000;

function asJson(value: unknown): Json {
  return value as Json;
}

/** Encaixa a caixa do elemento no aspecto real do recorte, mantendo o centro. */
function fitBoxToAspect(layer: StudioImageLayer, width: number, height: number) {
  if (!width || !height) return;
  const ratio = width / height;
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  let w = layer.width;
  let h = w / ratio;
  if (h > layer.height) {
    h = layer.height;
    w = h * ratio;
  }
  layer.width = Math.round(w);
  layer.height = Math.round(h);
  layer.x = Math.round(cx - w / 2);
  layer.y = Math.round(cy - h / 2);
}

function findImageLayer(doc: StudioDocument, job: StudioImageJob): StudioImageLayer | null {
  const page = doc.pages.find((p) => p.id === job.pageId);
  const layer = page?.layers.find((l) => l.id === job.layerId);
  return layer && layer.type === "image" ? layer : null;
}

function firstImage(doc: StudioDocument): string | null {
  for (const layer of doc.pages[0]?.layers ?? []) {
    if (layer.type === "image" && layer.src && layer.role !== "logo") return layer.src;
  }
  return null;
}

export function isGenerationStale(generation: StudioGeneration | null | undefined, updatedAt: string): boolean {
  const last = Date.parse(generation?.startedAt ?? updatedAt);
  const lastWrite = Date.parse(updatedAt);
  const newest = Math.max(Number.isFinite(last) ? last : 0, Number.isFinite(lastWrite) ? lastWrite : 0);
  return Date.now() - newest > STALE_GENERATION_MS;
}

export async function runStudioGeneration(carouselId: string): Promise<void> {
  const supabase = createAdminClient();
  const startedAt = Date.now();
  const runId = randomUUID();

  const { data: row, error: rowError } = await supabase
    .from("studio_carousels")
    .select("*")
    .eq("id", carouselId)
    .maybeSingle();
  if (rowError || !row) {
    console.error("[carousel-studio] carrossel não encontrado", carouselId, rowError?.message);
    return;
  }

  let generation: StudioGeneration = {
    runId,
    stage: "planning",
    message: "Lendo a ficha do cliente e o briefing…",
    done: 0,
    total: 0,
    error: null,
    startedAt: new Date(startedAt).toISOString(),
  };

  const isCurrentRun = async () => {
    const { data } = await supabase.from("studio_carousels").select("generation").eq("id", carouselId).maybeSingle();
    return (data?.generation as StudioGeneration | null)?.runId === runId;
  };

  await supabase
    .from("studio_carousels")
    .update({ status: "generating", generation: asJson(generation) })
    .eq("id", carouselId);

  try {
    // 1. Demanda + ficha
    let title = row.name;
    let artes: DemandArte[] = [];
    let handle: string | null = null;
    let clientId = row.client_id;
    const demandReferenceUrls: string[] = [];

    if (row.demand_id) {
      const [{ data: demand }, { data: refs }] = await Promise.all([
        supabase
          .from("creative_demands")
          .select("client_id, briefing, artes")
          .eq("id", row.demand_id)
          .maybeSingle(),
        supabase
          .from("demand_reference_image")
          .select("storage_url")
          .eq("demand_id", row.demand_id)
          .order("position", { ascending: true }),
      ]);
      if (demand) {
        const briefing = demand.briefing as unknown as DemandBriefing;
        artes = (demand.artes as unknown as DemandArte[]) ?? [];
        title = briefing?.titulo || title;
        handle = briefing?.instagramCliente || null;
        clientId = demand.client_id ?? clientId;
      }
      demandReferenceUrls.push(...(refs ?? []).map((r) => r.storage_url).filter(Boolean));
    }
    demandReferenceUrls.push(...((row.reference_urls as string[] | null) ?? []));

    const brand = await loadStudioBrandKit({ clientId, handle });
    const format = isStudioFormat(row.format) ? row.format : "4:5";

    generation = { ...generation, message: "Diretor de arte montando o carrossel…" };
    await supabase.from("studio_carousels").update({ generation: asJson(generation) }).eq("id", carouselId);

    // 2. Direção + layout
    const { plan, usedAi, error: directorError } = await directCarousel({
      title,
      artes,
      brand,
      format,
      brief: row.brief,
      demandReferenceUrls,
    });
    const { document, jobs } = buildStudioDocument({ plan, brand, format });

    if (!(await isCurrentRun())) return;
    generation = {
      ...generation,
      stage: "images",
      message: jobs.length ? `Gerando ${jobs.length} imagens…` : "Finalizando…",
      done: 0,
      total: jobs.length,
      error: usedAi ? null : `Diretor de arte indisponível, usado layout padrão (${directorError ?? "erro"})`,
    };
    await supabase
      .from("studio_carousels")
      .update({
        client_id: clientId,
        name: title || row.name,
        document: asJson(document),
        brand: asJson(brand),
        caption: plan.caption || null,
        generation: asJson(generation),
      })
      .eq("id", carouselId);

    // 3. Imagens — escritas serializadas sobre o documento em memória.
    const referenceUrls = [...demandReferenceUrls, ...brand.referenceUrls];
    let writeChain: Promise<boolean> = Promise.resolve(true);
    const persist = () => {
      writeChain = writeChain.then(async (alive) => {
        if (!alive || !(await isCurrentRun())) return false;
        await supabase
          .from("studio_carousels")
          .update({ document: asJson(document), generation: asJson(generation) })
          .eq("id", carouselId);
        return true;
      });
      return writeChain;
    };

    const limit = pLimit(IMAGE_CONCURRENCY);
    let done = 0;
    await Promise.all(
      jobs.map((job) =>
        limit(async () => {
          const layer = findImageLayer(document, job);
          if (!layer) return;
          if (Date.now() - startedAt > RUN_BUDGET_MS - 60_000) {
            layer.status = "failed";
            layer.error = "Tempo da geração esgotado — gere esta imagem de novo.";
          } else {
            try {
              const result = await generateStudioImage({
                carouselId,
                kind: job.kind,
                prompt: job.prompt,
                aspectRatio: job.aspectRatio,
                referenceUrls,
              });
              layer.src = result.url;
              layer.status = null;
              layer.error = null;
              if (job.kind === "element") fitBoxToAspect(layer, result.width, result.height);
            } catch (error) {
              layer.status = "failed";
              layer.error = error instanceof Error ? error.message : "Falha ao gerar a imagem";
              console.error("[carousel-studio] imagem falhou", { carouselId, layer: layer.id, error: layer.error });
            }
          }
          done += 1;
          generation = { ...generation, done, message: `Imagens ${done}/${jobs.length}` };
          await persist();
        })
      )
    );

    if (!(await writeChain) || !(await isCurrentRun())) return;
    const failed = jobs.filter((j) => findImageLayer(document, j)?.status === "failed").length;
    generation = {
      ...generation,
      stage: "done",
      message: failed ? `Pronto — ${failed} imagem(ns) falharam, gere de novo no editor.` : "Carrossel pronto para revisar.",
      finishedAt: new Date().toISOString(),
    };
    await supabase
      .from("studio_carousels")
      .update({
        status: "ready",
        document: asJson(document),
        generation: asJson(generation),
        thumbnail_url: firstImage(document),
      })
      .eq("id", carouselId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na geração";
    console.error("[carousel-studio] geração falhou", carouselId, message);
    if (!(await isCurrentRun())) return;
    await supabase
      .from("studio_carousels")
      .update({
        status: "failed",
        generation: asJson({ ...generation, stage: "failed", error: message, finishedAt: new Date().toISOString() }),
      })
      .eq("id", carouselId);
  }
}
