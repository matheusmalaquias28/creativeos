/**
 * Montagem da requisição de geração do "Space" (canvas node-based).
 *
 * Fonte ÚNICA do que vai para o provedor num job efêmero: o worker gera com
 * isto e o preview do node (`/flow/preview-node`) mostra exatamente isto. Só
 * entra o que está no grafo — prompt do node (onde a identidade da marca e a
 * frase da logo já estão como linhas visíveis), logo/refs/listas conectadas.
 */

import { buildLogoDirective } from "@/lib/flow/logo-directive";
import { compileSpacePrompt, type CreativeProfile } from "./prompt-compiler";

export type SpaceJobParams = {
  headline?: string | null;
  subheadline?: string | null;
  cta?: string | null;
  informacoesExtras?: string | null;
  aspect_ratio?: string;
  image_size?: string;
  quality?: "low" | "medium" | "high";
  count?: number;
  fanout_reference_urls?: string[] | null;
  skip_logo?: boolean;
  logo_position?: string | null;
  logo_size?: string | null;
  logo_directive?: string | null;
  briefing_titulo?: string | null;
  briefing_tipo?: string | null;
  flow_logo_url?: string | null;
  flow_references?: { url: string; role: string | null }[] | null;
};

export type SpaceReference = {
  url: string;
  intent: string;
  kind: "logo" | "ref" | "item";
};

export type SpaceRequest = {
  /** Referências fixas, na ordem enviada (logo primeiro, depois as refs). */
  references: SpaceReference[];
  /**
   * Uma entrada por geração do lote: `null` = variação do mesmo prompt (count);
   * referência = item da Lista em fan-out (vai como Imagem 1 daquela geração).
   */
  batch: (SpaceReference | null)[];
  /** Prompt enviado (sem as notas de correção da revisão automática). */
  prompt: string;
  logoUrl: string | null;
  aspectRatio: string;
  imageSize: string;
  quality: "low" | "medium" | "high";
};

/** Teto do lote de variações (`count`). O fan-out da Lista não tem teto. */
export const SPACE_MAX_COUNT = 6;

const FANOUT_INTENT = "item da lista — base principal desta arte";

/** No Space, perfil do cliente nunca entra por fora do que está no node. */
const NO_PROFILE: CreativeProfile = {
  base_prompt: "",
  palette: [],
  logo_mode: "composite",
  style_reference_urls: [],
};

export function buildSpaceRequest(
  params: SpaceJobParams,
  defaults: { aspectRatio: string; imageSize: string }
): SpaceRequest {
  const logoUrl = params.skip_logo ? null : params.flow_logo_url?.trim() || null;
  const logoDirective = logoUrl
    ? params.logo_directive?.trim() ||
      buildLogoDirective(params.logo_position ?? undefined, params.logo_size ?? undefined)
    : null;

  const references: SpaceReference[] = [];
  const seen = new Set<string>();
  if (logoUrl && logoDirective) {
    seen.add(logoUrl);
    references.push({ url: logoUrl, intent: logoDirective, kind: "logo" });
  }
  for (const ref of params.flow_references ?? []) {
    if (!ref.url?.trim() || seen.has(ref.url)) continue;
    seen.add(ref.url);
    references.push({
      url: ref.url,
      intent: ref.role?.trim() || "use esta imagem como referência visual",
      kind: "ref",
    });
  }

  const fanout = (params.fanout_reference_urls ?? []).filter((u) => u?.trim());
  const batch: (SpaceReference | null)[] =
    fanout.length > 0
      ? fanout.map((url) => ({ url, intent: FANOUT_INTENT, kind: "item" as const }))
      : Array.from(
          { length: Math.min(SPACE_MAX_COUNT, Math.max(1, params.count ?? 1)) },
          () => null
        );

  const aspectRatio = params.aspect_ratio ?? defaults.aspectRatio;
  const imageSize = params.image_size ?? defaults.imageSize;

  // Sem bloco de referências no corpo do prompt: o provedor anexa a lista
  // numerada ("Imagem N: papel") a partir das próprias referências enviadas —
  // assim a numeração sempre bate com as imagens (logo e item do fan-out
  // incluídos).
  const prompt = compileSpacePrompt(
    NO_PROFILE,
    { titulo: params.briefing_titulo ?? undefined, tipo: params.briefing_tipo ?? undefined },
    {
      headline: params.headline ?? undefined,
      subheadline: params.subheadline ?? undefined,
      cta: params.cta ?? undefined,
      informacoesExtras: params.informacoesExtras ?? undefined,
      aspect_ratio: aspectRatio,
      image_size: imageSize,
    },
    []
  );

  return {
    references,
    batch,
    prompt,
    logoUrl,
    aspectRatio,
    imageSize,
    quality: params.quality ?? "medium",
  };
}

/** Referências de UMA geração do lote: item do fan-out primeiro, depois as fixas. */
export function spaceReferencesFor(
  request: SpaceRequest,
  item: SpaceReference | null
): SpaceReference[] {
  return item
    ? [item, ...request.references.filter((r) => r.url !== item.url)]
    : request.references;
}
