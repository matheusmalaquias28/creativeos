import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeHexColor } from "@/lib/utils/color";
import type { StudioBrandKit } from "@/types/carousel-studio";
import type { VisualIdentityDna } from "@/lib/schemas/visual-identity";

/**
 * Ficha do cliente → kit de marca do carrossel.
 *
 * Junta o que hoje está espalhado: logo (perfil criativo → onboarding →
 * perfil de design do carrossel), paleta (perfil criativo + DNA visual +
 * perfil de design), fontes (perfil de design), DNA visual em texto e as
 * referências (amostras de identidade, página Referências e banco anotado).
 */

const MAX_REFERENCES = 8;

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function palette(values: unknown[]): string[] {
  return uniq(
    values
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .filter((v): v is string => typeof v === "string")
      .map((v) => normalizeHexColor(v))
      .filter((v): v is string => Boolean(v))
  ).slice(0, 10);
}

function dnaToText(dna: VisualIdentityDna | null, basePrompt: string | null): string {
  const parts: string[] = [];
  if (dna) {
    parts.push(`Resumo: ${dna.summary}`);
    parts.push(`Tipografia: títulos ${dna.typography.headlineStyle}; textos ${dna.typography.bodyStyle}${dna.typography.notes ? ` (${dna.typography.notes})` : ""}`);
    parts.push(`Composição: ${dna.compositionStyle}`);
    parts.push(`Mood: ${dna.mood}`);
    if (dna.visualKeywords?.length) parts.push(`Palavras-chave visuais: ${dna.visualKeywords.join(", ")}`);
    if (dna.elementsToRepeat?.length) parts.push(`Elementos recorrentes: ${dna.elementsToRepeat.join(", ")}`);
    if (dna.avoid?.length) parts.push(`Evitar: ${dna.avoid.join(", ")}`);
  }
  if (basePrompt?.trim()) parts.push(`Direção da marca: ${basePrompt.trim().slice(0, 600)}`);
  return parts.join("\n");
}

function companyInfoText(info: unknown): string {
  if (!info || typeof info !== "object") return "";
  return Object.entries(info as Record<string, unknown>)
    .filter(([, v]) => typeof v === "string" && v.trim())
    .map(([k, v]) => `${k}: ${String(v).trim()}`)
    .join("\n")
    .slice(0, 1200);
}

export async function loadStudioBrandKit(params: {
  clientId: string | null;
  handle?: string | null;
}): Promise<StudioBrandKit> {
  const empty: StudioBrandKit = {
    clientId: params.clientId,
    clientName: "",
    logoUrl: null,
    handle: params.handle?.trim() ?? "",
    palette: [],
    fontHeading: null,
    fontBody: null,
    styleNotes: "",
    businessContext: "",
    referenceUrls: [],
  };
  if (!params.clientId) return empty;

  const supabase = createAdminClient();
  const clientId = params.clientId;
  const [client, profile, onboarding, refs, assets, designProfile] = await Promise.all([
    supabase.from("clients").select("name, company_info").eq("id", clientId).maybeSingle(),
    supabase
      .from("client_creative_profile")
      .select("logo_url, palette, base_prompt, visual_identity_dna, identity_sample_urls")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase.from("onboarding_answers").select("answers").eq("client_id", clientId).maybeSingle(),
    supabase
      .from("client_references")
      .select("public_url")
      .eq("client_id", clientId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("client_reference_asset")
      .select("storage_url, kind, is_winner, ai_description")
      .eq("client_id", clientId)
      .eq("active", true)
      .order("is_winner", { ascending: false })
      .order("position", { ascending: true }),
    supabase
      .from("carousel_profiles")
      .select("logo_url, font_title, font_body, color_background, color_title, color_subtitle, color_accent, palette, instagram_handle, context_md, business_context")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const answers = (onboarding.data?.answers ?? {}) as { logoUrl?: string; visualNotes?: string };
  const p = profile.data;
  const dp = designProfile.data;
  const dna = (p?.visual_identity_dna ?? null) as VisualIdentityDna | null;

  const referenceUrls = uniq([
    // Vencedoras/estilo primeiro: são as que mais dizem sobre a cara da marca.
    ...(assets.data ?? [])
      .filter((a) => a.kind === "estilo" || a.kind === "layout" || a.is_winner)
      .map((a) => a.storage_url),
    ...((p?.identity_sample_urls as string[] | null) ?? []),
    ...(refs.data ?? []).map((r) => r.public_url),
    ...(assets.data ?? []).map((a) => a.storage_url),
  ].filter((u): u is string => typeof u === "string" && u.startsWith("http"))).slice(0, MAX_REFERENCES);

  const styleNotes = [dnaToText(dna, p?.base_prompt ?? null), answers.visualNotes?.trim() ? `Notas do onboarding: ${answers.visualNotes.trim()}` : ""]
    .filter(Boolean)
    .join("\n");

  const businessContext = [dp?.context_md?.trim() || dp?.business_context?.trim() || "", companyInfoText(client.data?.company_info)]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2500);

  return {
    clientId,
    clientName: client.data?.name ?? "",
    logoUrl: p?.logo_url || answers.logoUrl?.trim() || dp?.logo_url || null,
    handle: params.handle?.trim() || dp?.instagram_handle?.trim() || "",
    palette: palette([
      p?.palette,
      dna?.palette,
      dp?.color_background,
      dp?.color_title,
      dp?.color_accent,
      dp?.color_subtitle,
      dp?.palette,
    ]),
    fontHeading: dp?.font_title ?? null,
    fontBody: dp?.font_body ?? null,
    styleNotes,
    businessContext,
    referenceUrls,
  };
}
