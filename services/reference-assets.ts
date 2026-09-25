import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReferenceKind } from "@/lib/ai/art-director/types";

export type ReferenceAssetRow = {
  id: string;
  client_id: string;
  kind: ReferenceKind;
  storage_url: string;
  storage_path: string | null;
  file_name: string | null;
  ai_description: string | null;
  ai_tags: string[];
  dominant_colors: string[];
  annotation_status: "idle" | "annotating" | "ready" | "failed";
  annotation_error: string | null;
  usage_count: number;
  last_used_at: string | null;
  is_winner: boolean;
  active: boolean;
  position: number;
  created_at: string;
};

export type ClientArtReadiness = {
  client_id: string;
  name: string;
  /** Logo efetiva do cliente: perfil criativo, com fallback no onboarding. */
  logo_url: string | null;
  has_logo: boolean;
  has_palette: boolean;
  has_dna: boolean;
  reference_count: number;
  style_reference_count: number;
  is_ready: boolean;
};

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function getReferenceAssets(
  clientId: string,
  includeInactive = false
): Promise<ReferenceAssetRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("client_reference_asset")
    .select("*")
    .eq("client_id", clientId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (!includeInactive) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ReferenceAssetRow[];
}

export async function getClientArtReadiness(
  clientId: string
): Promise<ClientArtReadiness | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_art_readiness")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ClientArtReadiness | null) ?? null;
}

/** Motivos legíveis do que falta — o operador não deve descobrir isso só após clicar. */
export function missingForReadiness(readiness: ClientArtReadiness | null): string[] {
  if (!readiness) return ["perfil criativo não cadastrado"];

  const missing: string[] = [];
  if (!readiness.has_logo) missing.push("logo");
  if (!readiness.has_palette) missing.push("paleta com ao menos 2 cores");
  if (!readiness.has_dna) missing.push("DNA visual extraído");
  if (readiness.reference_count < 4) {
    missing.push(`${4 - readiness.reference_count} referência(s) no acervo`);
  } else if (readiness.style_reference_count < 1) {
    missing.push("ao menos 1 referência de estilo");
  }
  return missing;
}

// ---------------------------------------------------------------------------
// Escrita (admin — server actions e rotas)
// ---------------------------------------------------------------------------

export async function createReferenceAsset(input: {
  clientId: string;
  kind: ReferenceKind;
  storageUrl: string;
  storagePath?: string | null;
  fileName?: string | null;
}): Promise<ReferenceAssetRow> {
  const supabase = createAdminClient();

  const { count } = await supabase
    .from("client_reference_asset")
    .select("id", { count: "exact", head: true })
    .eq("client_id", input.clientId);

  const { data, error } = await supabase
    .from("client_reference_asset")
    .insert({
      client_id: input.clientId,
      kind: input.kind,
      storage_url: input.storageUrl,
      storage_path: input.storagePath ?? null,
      file_name: input.fileName ?? null,
      position: count ?? 0,
      annotation_status: "annotating",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ReferenceAssetRow;
}

export async function saveAnnotation(
  assetId: string,
  annotation: { description: string; tags: string[]; colors: string[]; kind: ReferenceKind }
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("client_reference_asset")
    .update({
      ai_description: annotation.description,
      ai_tags: annotation.tags,
      dominant_colors: annotation.colors,
      kind: annotation.kind,
      annotation_status: "ready",
      annotation_error: null,
    })
    .eq("id", assetId);
  if (error) throw new Error(error.message);
}

export async function failAnnotation(assetId: string, message: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("client_reference_asset")
    .update({ annotation_status: "failed", annotation_error: message.slice(0, 300) })
    .eq("id", assetId);
}

export async function setReferenceAssetActive(
  assetId: string,
  active: boolean
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("client_reference_asset")
    .update({ active })
    .eq("id", assetId);
  if (error) throw new Error(error.message);
}

export async function updateReferenceAssetKind(
  assetId: string,
  kind: ReferenceKind
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("client_reference_asset")
    .update({ kind })
    .eq("id", assetId);
  if (error) throw new Error(error.message);
}

/**
 * Incrementa o uso das referências de um job. Chamado na APROVAÇÃO, não no
 * rascunho: regenerar um prompt três vezes não pode inflar o contador e
 * envenenar o critério de rotação do catálogo.
 */
export async function bumpReferenceUsage(assetIds: string[]): Promise<void> {
  const unique = Array.from(new Set(assetIds.filter(Boolean)));
  if (unique.length === 0) return;

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: rows } = await supabase
    .from("client_reference_asset")
    .select("id, usage_count")
    .in("id", unique);

  await Promise.all(
    (rows ?? []).map((row) =>
      supabase
        .from("client_reference_asset")
        .update({ usage_count: ((row.usage_count as number) ?? 0) + 1, last_used_at: now })
        .eq("id", row.id)
    )
  );
}
