import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCarouselDemand } from "@/lib/carousel-studio/demand";
import { isGenerationStale } from "@/lib/carousel-studio/generate";
import {
  isStudioBusy,
  isStudioDocument,
  isStudioFormat,
  makeEmptyDocument,
  type StudioCarousel,
  type StudioGeneration,
  type StudioStatus,
} from "@/types/carousel-studio";
import type { Database } from "@/types/database";

type Row = Database["public"]["Tables"]["studio_carousels"]["Row"];

const STATUSES: StudioStatus[] = ["idle", "queued", "generating", "ready", "failed"];

export function toStudioCarousel(row: Row): StudioCarousel {
  const format = isStudioFormat(row.format) ? row.format : "4:5";
  return {
    ...row,
    format,
    status: STATUSES.includes(row.status as StudioStatus) ? (row.status as StudioStatus) : "idle",
    document: isStudioDocument(row.document) ? row.document : makeEmptyDocument(format),
    brand: (row.brand ?? {}) as StudioCarousel["brand"],
    reference_urls: Array.isArray(row.reference_urls) ? (row.reference_urls as string[]) : [],
    generation: (row.generation ?? {}) as StudioGeneration,
  };
}

export const getStudioCarousel = cache(async (id: string): Promise<StudioCarousel | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("studio_carousels").select("*").eq("id", id).maybeSingle();
  return data ? toStudioCarousel(data) : null;
});

export async function getStudioCarouselForDemand(demandId: string): Promise<StudioCarousel | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("studio_carousels").select("*").eq("demand_id", demandId).maybeSingle();
  return data ? toStudioCarousel(data) : null;
}

export type StudioCarouselListItem = Pick<
  StudioCarousel,
  "id" | "name" | "status" | "format" | "demand_id" | "client_id" | "thumbnail_url" | "updated_at"
> & { page_count: number; client_name: string | null };

export async function listStudioCarousels(limit = 60): Promise<StudioCarouselListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("studio_carousels")
    .select("id, name, status, format, demand_id, client_id, thumbnail_url, updated_at, document")
    .order("updated_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const clientIds = Array.from(new Set(rows.map((r) => r.client_id).filter((v): v is string => Boolean(v))));
  const names = new Map<string, string>();
  if (clientIds.length) {
    const { data: clients } = await supabase.from("clients").select("id, name").in("id", clientIds);
    (clients ?? []).forEach((c) => names.set(c.id, c.name));
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: (STATUSES.includes(r.status as StudioStatus) ? r.status : "idle") as StudioStatus,
    format: isStudioFormat(r.format) ? r.format : "4:5",
    demand_id: r.demand_id,
    client_id: r.client_id,
    thumbnail_url: r.thumbnail_url,
    updated_at: r.updated_at,
    page_count: isStudioDocument(r.document) ? r.document.pages.length : 0,
    client_name: r.client_id ? names.get(r.client_id) ?? null : null,
  }));
}

/**
 * Garante o studio da demanda (cria vazio se ainda não existir). Usa o admin
 * client: é chamado pelo webhook (sem sessão) e pela página da demanda.
 */
export async function ensureStudioForDemand(demandId: string): Promise<StudioCarousel | null> {
  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("studio_carousels").select("*").eq("demand_id", demandId).maybeSingle();
  if (existing) return toStudioCarousel(existing);

  const { data: demand } = await supabase
    .from("creative_demands")
    .select("id, client_id, tipo, briefing, raw_payload")
    .eq("id", demandId)
    .maybeSingle();
  if (!demand) return null;
  const briefing = (demand.briefing ?? {}) as { titulo?: string; tipo?: string };
  if (!isCarouselDemand({ tipo: demand.tipo, briefing, raw_payload: demand.raw_payload })) return null;

  const { data, error } = await supabase
    .from("studio_carousels")
    .upsert(
      {
        demand_id: demandId,
        client_id: demand.client_id,
        name: briefing.titulo?.trim() || "Carrossel",
        format: "4:5",
        status: "idle",
        document: makeEmptyDocument("4:5") as unknown as Database["public"]["Tables"]["studio_carousels"]["Insert"]["document"],
      },
      { onConflict: "demand_id", ignoreDuplicates: false }
    )
    .select("*")
    .single();
  if (error || !data) {
    console.error("[carousel-studio] falha ao criar studio da demanda", demandId, error?.message);
    return null;
  }
  return toStudioCarousel(data);
}

/**
 * Marca o carrossel como "na fila" se nada estiver rodando. Devolve false se
 * já existe uma geração viva — o chamador NÃO deve disparar outra.
 * O disparo em si (`after(() => runStudioGeneration(id))`) fica com quem chama,
 * porque `after()` precisa do escopo da requisição.
 */
export async function claimStudioGeneration(
  carouselId: string,
  opts: { brief?: string | null; force?: boolean } = {}
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("studio_carousels")
    .select("status, generation, updated_at, demand_id, client_id")
    .eq("id", carouselId)
    .maybeSingle();
  if (!row) return { ok: false, reason: "Carrossel não encontrado" };

  const busy = isStudioBusy(row.status as StudioStatus);
  if (busy && !opts.force && !isGenerationStale(row.generation as StudioGeneration, row.updated_at)) {
    return { ok: false, reason: "Já existe uma geração em andamento" };
  }

  if (row.demand_id && !row.client_id) {
    const { data: demand } = await supabase.from("creative_demands").select("client_id").eq("id", row.demand_id).maybeSingle();
    if (!demand?.client_id) return { ok: false, reason: "Vincule a demanda a um cliente antes de gerar" };
  }

  const update: Database["public"]["Tables"]["studio_carousels"]["Update"] = {
    status: "queued",
    generation: { stage: "queued", message: "Na fila…", queuedAt: new Date().toISOString() },
  };
  if (opts.brief !== undefined) update.brief = opts.brief;
  await supabase.from("studio_carousels").update(update).eq("id", carouselId);
  return { ok: true };
}
