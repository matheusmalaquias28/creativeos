/**
 * Montagem da requisição de geração do "Space" (canvas node-based).
 *
 * Fonte ÚNICA do que vai para o provedor num job efêmero: o worker gera com
 * isto e o preview do node (`/flow/preview-node`) mostra exatamente isto. Só
 * entra o que está no grafo — prompt do node (onde a identidade da marca e a
 * frase da logo já estão como linhas visíveis), logo/refs/listas conectadas.
 *
 * As referências abrem o prompt, numeradas na ordem em que as imagens vão
 * (Imagem 1, 2…), como a diretiva principal da arte. A ordem importa: o modelo
 * preserva melhor as primeiras imagens, então o sujeito (pessoa/produto) vai na
 * frente, depois a logo, e por último as referências de estilo/ambiente.
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
  flow_references?: { url: string; role: string | null; category?: string | null }[] | null;
};

export type SpaceReference = {
  url: string;
  intent: string;
  kind: "logo" | "ref" | "item";
  /** Rótulo curto do papel da imagem (Sujeito, Logo, Estilo…). */
  label: string;
};

export type SpaceRequest = {
  /** Referências fixas, na ordem enviada. */
  references: SpaceReference[];
  /**
   * Uma entrada por geração do lote: `null` = variação do mesmo prompt (count);
   * referência = item da Lista em fan-out (vai como Imagem 1 daquela geração).
   */
  batch: (SpaceReference | null)[];
  /** Corpo do prompt (direção, copy, técnico) — sem o bloco de referências. */
  body: string;
  logoUrl: string | null;
  aspectRatio: string;
  imageSize: string;
  quality: "low" | "medium" | "high";
};

/** Teto do lote de variações (`count`). O fan-out da Lista não tem teto. */
export const SPACE_MAX_COUNT = 6;

const FANOUT_INTENT =
  "é a imagem-base desta arte: reproduza o conteúdo, a composição e o visual dela com fidelidade";

const CATEGORY_LABEL: Record<string, string> = {
  subject: "Sujeito/produto",
  brand: "Marca",
  style: "Estilo",
  environment: "Ambiente",
};

/** Ordem de envio: sujeito → logo → marca → sem categoria → ambiente → estilo. */
const CATEGORY_RANK: Record<string, number> = {
  subject: 0,
  brand: 2,
  environment: 4,
  style: 5,
};
const LOGO_RANK = 1;
const UNCATEGORIZED_RANK = 3;

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

  const ranked: { ref: SpaceReference; rank: number; order: number }[] = [];
  const seen = new Set<string>();
  if (logoUrl && logoDirective) {
    seen.add(logoUrl);
    ranked.push({
      ref: { url: logoUrl, intent: logoDirective, kind: "logo", label: "Logo" },
      rank: LOGO_RANK,
      order: 0,
    });
  }
  (params.flow_references ?? []).forEach((ref, i) => {
    if (!ref.url?.trim() || seen.has(ref.url)) return;
    seen.add(ref.url);
    const category = ref.category ?? "";
    ranked.push({
      ref: {
        url: ref.url,
        intent: ref.role?.trim() || "use esta imagem como referência visual",
        kind: "ref",
        label: CATEGORY_LABEL[category] ?? "Referência",
      },
      rank: CATEGORY_RANK[category] ?? UNCATEGORIZED_RANK,
      order: i + 1,
    });
  });
  const references = ranked
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map((r) => r.ref);

  const fanout = (params.fanout_reference_urls ?? []).filter((u) => u?.trim());
  const batch: (SpaceReference | null)[] =
    fanout.length > 0
      ? fanout.map((url) => ({ url, intent: FANOUT_INTENT, kind: "item" as const, label: "Item da lista" }))
      : Array.from(
          { length: Math.min(SPACE_MAX_COUNT, Math.max(1, params.count ?? 1)) },
          () => null
        );

  const aspectRatio = params.aspect_ratio ?? defaults.aspectRatio;
  const imageSize = params.image_size ?? defaults.imageSize;

  const body = compileSpacePrompt(
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
    body,
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

/**
 * Prompt de UMA geração: abre com as imagens anexadas (numeradas na ordem em
 * que vão, cada uma com o seu papel) e segue com o corpo. As imagens são a
 * diretiva principal — o texto diz o que muda em cima delas.
 */
export function spacePromptFor(request: SpaceRequest, item: SpaceReference | null): string {
  const refs = spaceReferencesFor(request, item);
  if (refs.length === 0) return request.body;
  const block = [
    "IMAGENS ANEXADAS — elas são a base desta arte. Siga cada uma exatamente no papel indicado:",
    ...refs.map((r, i) => `- Imagem ${i + 1} (${r.label}): ${r.intent}`),
  ].join("\n");
  return `${block}\n\n${request.body}`;
}
