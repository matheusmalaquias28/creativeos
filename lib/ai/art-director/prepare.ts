/**
 * Orquestração: da demanda aos prompts esperando aprovação.
 *
 * As artes são dirigidas EM SEQUÊNCIA, não em paralelo: cada uma recebe os
 * conceitos das irmãs já escritas e é obrigada a se diferenciar. ~4s por arte,
 * ~20s numa demanda de 5 — o custo de não ver 5 variações da mesma ideia.
 *
 * A logo nunca entra como referência do modelo de imagem: ela é composta depois,
 * sem fundo e com contraste garantido (lib/ai/imagegen/brand-logo.ts).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import { ART_ASPECT_RATIO, ART_IMAGE_SIZE_FALLBACK } from "./constants";
import type { VisualIdentityDna } from "@/lib/schemas/visual-identity";
import { buildReferenceCatalog } from "./catalog";
import { enforceDistinctReferenceSets, type ArtReferenceSet } from "./dedupe";
import { directArt } from "./direct-art";
import type {
  ArtDirection,
  ArtDirectionInput,
  ClientPhoto,
  DirectionMeta,
  DirectionNote,
  ReferenceAsset,
  ReferenceCatalog,
  ReferenceKind,
  SiblingConcept,
} from "./types";

/** A curadoria gera só pelo Gemini, direto — nada de Magnific. */
export const ART_DIRECTOR_IMAGE_MODEL = "gemini";

type Supabase = ReturnType<typeof createAdminClient>;

export type PrepareResult = {
  jobsPrepared: number;
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Carregamento de contexto
// ---------------------------------------------------------------------------

type ProfileRow = {
  base_prompt: string | null;
  palette: string[] | null;
  logo_url: string | null;
  logo_mode: string | null;
  image_size: string | null;
  aspect_ratio: string | null;
  visual_identity_dna: unknown;
  direction_notes: unknown;
};

export async function loadReferenceAssets(
  supabase: Supabase,
  clientId: string
): Promise<ReferenceAsset[]> {
  const { data, error } = await supabase
    .from("client_reference_asset")
    .select("id, kind, storage_url, ai_description, ai_tags, usage_count, last_used_at, is_winner")
    .eq("client_id", clientId)
    .eq("active", true)
    .order("position", { ascending: true });

  if (error) throw new Error(`Falha ao carregar o acervo: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    kind: row.kind as ReferenceKind,
    storageUrl: row.storage_url as string,
    aiDescription: (row.ai_description as string | null) ?? null,
    aiTags: (row.ai_tags as string[] | null) ?? [],
    usageCount: (row.usage_count as number | null) ?? 0,
    lastUsedAt: (row.last_used_at as string | null) ?? null,
    isWinner: Boolean(row.is_winner),
  }));
}

/**
 * Fotos reais do cliente. Só são carregadas quando o operador marcou a arte —
 * ver `use_client_photos` em art_generation_job.
 */
export async function loadClientPhotos(
  supabase: Supabase,
  clientId: string
): Promise<ClientPhoto[]> {
  const { data } = await supabase
    .from("client_photos")
    .select("public_url")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true });

  return (data ?? [])
    .map((row) => ({ url: row.public_url as string }))
    .filter((p) => Boolean(p.url));
}

function parseDirectionNotes(raw: unknown): DirectionNote[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n): n is Record<string, unknown> => Boolean(n) && typeof n === "object")
    .map((n) => ({
      note: String(n.note ?? "").trim(),
      source: (n.source === "diff" || n.source === "manual" ? n.source : "steer") as
        | "steer"
        | "diff"
        | "manual",
      hits: Number(n.hits ?? 1),
    }))
    .filter((n) => n.note.length > 0);
}

// ---------------------------------------------------------------------------
// Persistência das referências escolhidas
// ---------------------------------------------------------------------------

/**
 * A paleta canônica é a coluna `palette`, mas ela só é preenchida quando a
 * extração de DNA roda. Perfis extraídos antes disso têm as cores apenas dentro
 * do DNA — ler as duas origens evita que o cliente gere arte sem paleta.
 */
export function resolvePalette(
  paletteColumn: string[] | null,
  dna: VisualIdentityDna | null
): string[] {
  if (paletteColumn?.length) return paletteColumn;
  return dna?.palette ?? [];
}

async function persistReferences(
  supabase: Supabase,
  jobId: string,
  direction: ArtDirection,
  logoUrl: string | null,
  logoAsReference: boolean,
  clientPhotos: ClientPhoto[] = []
): Promise<void> {
  await supabase.from("art_job_reference").delete().eq("job_id", jobId);

  type JobReferenceInsert =
    Database["public"]["Tables"]["art_job_reference"]["Insert"];
  const rows: JobReferenceInsert[] = [];

  // Posição 0 é sempre a logo quando ela entra como referência. Com
  // logo_mode='composite' (padrão) ela não entra — o sharp sobrepõe depois.
  if (logoAsReference && logoUrl) {
    rows.push({
      job_id: jobId,
      asset_id: null,
      storage_url: logoUrl,
      role: "logo",
      intent: null,
      position: 0,
      source: "client_fixed",
    });
  }

  // Logo pessoa real antes das referências de estilo: ela é o assunto da cena,
  // não um insumo estético, e o modelo pondera as primeiras referências mais.
  for (const photo of clientPhotos) {
    rows.push({
      job_id: jobId,
      asset_id: null,
      storage_url: photo.url,
      role: "personagem",
      intent:
        "foto real do cliente — é esta pessoa que aparece na arte, sem alterar rosto, corpo ou identidade",
      position: rows.length,
      source: "client_fixed",
    });
  }

  for (const ref of direction.references) {
    rows.push({
      job_id: jobId,
      asset_id: ref.assetId,
      storage_url: ref.storageUrl,
      role: ref.role,
      intent: ref.intent,
      position: rows.length,
      source: "ai",
    });
  }

  if (rows.length === 0) return;

  const { error } = await supabase.from("art_job_reference").insert(rows);
  if (error) throw new Error(`Falha ao salvar referências: ${error.message}`);
}

function masterToken(direction: ArtDirection, catalog: ReferenceCatalog): string | null {
  const master = direction.references[0];
  if (!master) return null;
  return catalog.entries.find((e) => e.asset.id === master.assetId)?.token ?? null;
}

function buildMeta(
  direction: ArtDirection,
  steer: string | null,
  model: string,
  catalog: ReferenceCatalog
): DirectionMeta {
  const catalogSize = catalog.entries.length;
  return {
    master: masterToken(direction, catalog),
    concept: direction.concept,
    differentiator: direction.differentiator,
    negative: direction.negative,
    steer,
    model,
    catalogSize,
    writtenAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// prepareDemandPrompts
// ---------------------------------------------------------------------------

export async function prepareDemandPrompts(
  demandId: string,
  options: { parallel?: boolean } = {}
): Promise<PrepareResult> {
  const supabase = createAdminClient();

  const { data: demand, error: demandError } = await supabase
    .from("creative_demands")
    .select("id, client_id, client_name_external, briefing, artes")
    .eq("id", demandId)
    .single();

  if (demandError || !demand) throw new Error("Demanda não encontrada");
  if (!demand.client_id) throw new Error("Demanda sem cliente vinculado");

  const { data: readiness } = await supabase
    .from("client_art_readiness")
    .select("is_ready, has_logo, has_palette, has_dna, reference_count, logo_url")
    .eq("client_id", demand.client_id)
    .maybeSingle();

  if (!readiness?.is_ready) {
    const missing = [
      !readiness?.has_logo ? "logo" : null,
      !readiness?.has_palette ? "paleta" : null,
      !readiness?.has_dna ? "DNA visual" : null,
      (readiness?.reference_count ?? 0) < 4 ? "pelo menos 4 referências" : null,
    ].filter(Boolean);
    throw new Error(`Cliente sem kit completo — falta: ${missing.join(", ")}`);
  }

  const { data: profileRow } = await supabase
    .from("client_creative_profile")
    .select(
      "base_prompt, palette, logo_url, logo_mode, image_size, aspect_ratio, visual_identity_dna, direction_notes"
    )
    .eq("client_id", demand.client_id)
    .maybeSingle();

  const profile = (profileRow ?? {}) as ProfileRow;
  const assets = await loadReferenceAssets(supabase, demand.client_id);
  const catalog = buildReferenceCatalog(assets);

  const artes = Array.isArray(demand.artes) ? (demand.artes as Record<string, unknown>[]) : [];
  if (artes.length === 0) return { jobsPrepared: 0, warnings: ["Demanda sem artes"] };

  const briefing = (demand.briefing ?? {}) as Record<string, unknown>;

  // Limpa preparos anteriores que ainda não foram aprovados. Jobs já em
  // queued/processing/succeeded nunca são tocados.
  await supabase
    .from("art_generation_job")
    .delete()
    .eq("demand_id", demandId)
    .in("status", ["draft", "writing_prompt", "awaiting_approval"]);

  const dna = (profile.visual_identity_dna as VisualIdentityDna | null) ?? null;
  // A view já resolve a logo do onboarding quando o perfil não sincronizou.
  const effectiveLogoUrl = readiness.logo_url ?? profile.logo_url ?? null;

  // 3:4 SEMPRE: ignora profile.aspect_ratio e o aspectRatio da arte do Make.
  const aspectRatio = ART_ASPECT_RATIO;
  const imageSize = profile.image_size ?? ART_IMAGE_SIZE_FALLBACK;
  // Logo nunca é referência do modelo de imagem (ver cabeçalho).
  const logoAsReference = false;

  const jobRows = artes.map((arte, index) => ({
    demand_id: demandId,
    client_id: demand.client_id,
    art_index: index,
    status: "draft" as const,
    params: {
      headline: (arte.headline as string) ?? null,
      subheadline: (arte.subheadline as string) ?? null,
      cta: (arte.cta as string) ?? null,
      informacoesExtras: (arte.informacoesExtras as string) ?? null,
      aspect_ratio: aspectRatio,
      image_size: (arte.imageSize as string) ?? imageSize,
      model: ART_DIRECTOR_IMAGE_MODEL,
      briefing_titulo: (briefing.titulo as string) ?? null,
      briefing_tipo: (briefing.tipo as string) ?? null,
    },
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("art_generation_job")
    .insert(jobRows)
    .select("id, art_index, params");

  if (insertError) throw new Error(`Falha ao criar os jobs: ${insertError.message}`);

  const jobs = (inserted ?? []).sort(
    (a, b) => (a.art_index as number) - (b.art_index as number)
  );

  const clientContext: ArtDirectionInput["client"] = {
    name: String((demand as { client_name_external?: string }).client_name_external ?? "cliente"),
    dna,
    basePrompt: profile.base_prompt ?? "",
    palette: resolvePalette(profile.palette, dna),
    directionNotes: parseDirectionNotes(profile.direction_notes),
  };

  const siblings: SiblingConcept[] = [];
  const directions: { jobId: string; artIndex: number; direction: ArtDirection }[] = [];
  const warnings: string[] = [];

  const directJob = async (
    job: (typeof jobs)[number],
    extra: { siblings: SiblingConcept[]; assignedMaster: string | null }
  ) => {
    const params = job.params as Record<string, unknown>;
    const artIndex = job.art_index as number;

    await supabase
      .from("art_generation_job")
      .update({ status: "writing_prompt", updated_at: new Date().toISOString() })
      .eq("id", job.id);

    try {
      const direction = await directArt({
        client: clientContext,
        catalog,
        demand: {
          titulo: (params.briefing_titulo as string) ?? null,
          tipo: (params.briefing_tipo as string) ?? null,
        },
        art: {
          index: artIndex,
          headline: params.headline as string | null,
          subheadline: params.subheadline as string | null,
          cta: params.cta as string | null,
          informacoesExtras: params.informacoesExtras as string | null,
          aspectRatio,
          imageSize: (params.image_size as string) ?? imageSize,
        },
        siblings: extra.siblings,
        assignedMaster: extra.assignedMaster,
        clientPhotos: [],
        steer: null,
      });
      directions.push({ jobId: job.id as string, artIndex, direction });
      return direction;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Arte ${artIndex + 1}: ${message}`);
      await supabase
        .from("art_generation_job")
        .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
        .eq("id", job.id);
      return null;
    }
  };

  if (options.parallel) {
    // Em paralelo, a variedade vem de mestres distintos pré-atribuídos (do menos
    // usado para o mais usado), já que as irmãs ainda não existem.
    await Promise.all(
      jobs.map((job, i) =>
        directJob(job, {
          siblings: [],
          assignedMaster: catalog.entries.length
            ? catalog.entries[i % catalog.entries.length].token
            : null,
        })
      )
    );
    directions.sort((x, y) => x.artIndex - y.artIndex);
  } else {
    for (const job of jobs) {
      const direction = await directJob(job, { siblings: [...siblings], assignedMaster: null });
      if (direction) {
        siblings.push({
          index: job.art_index as number,
          concept: direction.concept,
          master: masterToken(direction, catalog),
        });
      }
    }
  }

  // Rede de anti-repetição: instrução não é garantia, e 5 artes iguais é o
  // pior modo de falha para quem revisa.
  const sets: ArtReferenceSet[] = directions.map((d) => ({
    artIndex: d.artIndex,
    references: d.direction.references,
  }));
  const deduped = enforceDistinctReferenceSets(sets, catalog);
  warnings.push(...deduped.warnings);

  for (const [i, entry] of directions.entries()) {
    const direction: ArtDirection = {
      ...entry.direction,
      references: deduped.sets[i]?.references ?? entry.direction.references,
    };

    await persistReferences(
      supabase,
      entry.jobId,
      direction,
      effectiveLogoUrl,
      logoAsReference
    );

    await supabase
      .from("art_generation_job")
      .update({
        status: "awaiting_approval",
        prompt_draft: direction.prompt,
        prompt_edited: null,
        direction: buildMeta(direction, null, "art-director", catalog),
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.jobId);
  }

  return { jobsPrepared: directions.length, warnings };
}

// ---------------------------------------------------------------------------
// rewriteJobPrompt — regenerar uma arte com direção do operador
// ---------------------------------------------------------------------------

export async function rewriteJobPrompt(
  jobId: string,
  steer: string | null
): Promise<ArtDirection> {
  const supabase = createAdminClient();

  const { data: job, error } = await supabase
    .from("art_generation_job")
    .select("id, demand_id, client_id, art_index, params, use_client_photos")
    .eq("id", jobId)
    .single();

  if (error || !job) throw new Error("Job não encontrado");
  if (!job.client_id) throw new Error("Job sem cliente vinculado");

  const { data: profileRow } = await supabase
    .from("client_creative_profile")
    .select(
      "base_prompt, palette, logo_url, logo_mode, image_size, aspect_ratio, visual_identity_dna, direction_notes"
    )
    .eq("client_id", job.client_id)
    .maybeSingle();

  const profile = (profileRow ?? {}) as ProfileRow;
  const dna = (profile.visual_identity_dna as VisualIdentityDna | null) ?? null;

  const { data: readiness } = await supabase
    .from("client_art_readiness")
    .select("logo_url")
    .eq("client_id", job.client_id)
    .maybeSingle();

  const effectiveLogoUrl = readiness?.logo_url ?? profile.logo_url ?? null;

  const assets = await loadReferenceAssets(supabase, job.client_id);
  const catalog = buildReferenceCatalog(assets);

  const clientPhotos = job.use_client_photos
    ? await loadClientPhotos(supabase, job.client_id)
    : [];

  // Conceitos das irmãs para continuar diferenciando na regeneração.
  const { data: siblingRows } = await supabase
    .from("art_generation_job")
    .select("art_index, direction")
    .eq("demand_id", job.demand_id)
    .neq("id", jobId);

  const siblings: SiblingConcept[] = (siblingRows ?? [])
    .map((row) => {
      const meta = row.direction as DirectionMeta | null;
      return meta?.concept
        ? ({ index: row.art_index as number, concept: meta.concept, master: meta.master ?? null } as SiblingConcept)
        : null;
    })
    .filter((s): s is SiblingConcept => s !== null);

  await supabase
    .from("art_generation_job")
    .update({ status: "writing_prompt", updated_at: new Date().toISOString() })
    .eq("id", jobId);

  const params = job.params as Record<string, unknown>;

  try {
    const direction = await directArt({
      client: {
        name: "cliente",
        dna,
        basePrompt: profile.base_prompt ?? "",
        palette: resolvePalette(profile.palette, dna),
        directionNotes: parseDirectionNotes(profile.direction_notes),
      },
      catalog,
      demand: {
        titulo: (params.briefing_titulo as string) ?? null,
        tipo: (params.briefing_tipo as string) ?? null,
      },
      art: {
        index: job.art_index as number,
        headline: params.headline as string | null,
        subheadline: params.subheadline as string | null,
        cta: params.cta as string | null,
        informacoesExtras: params.informacoesExtras as string | null,
        aspectRatio: ART_ASPECT_RATIO,
        imageSize: (params.image_size as string) ?? ART_IMAGE_SIZE_FALLBACK,
      },
      siblings,
      clientPhotos,
      steer,
    });

    await persistReferences(
      supabase,
      jobId,
      direction,
      effectiveLogoUrl,
      false,
      clientPhotos
    );

    await supabase
      .from("art_generation_job")
      .update({
        status: "awaiting_approval",
        prompt_draft: direction.prompt,
        // Regenerar descarta a edição anterior — ela era de outro prompt.
        prompt_edited: null,
        direction: buildMeta(direction, steer, "art-director", catalog),
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return direction;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("art_generation_job")
      .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    throw err;
  }
}
