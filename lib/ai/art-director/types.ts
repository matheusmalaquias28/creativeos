/**
 * Contratos da camada de direção de arte.
 *
 * A camada substitui a concatenação determinística de `compilePrompt()` por uma
 * decisão de direção de arte: escolhe referências do acervo do cliente e escreve
 * uma cena. O bloco técnico (ver `technical-block.ts`) continua determinístico e
 * é anexado depois — regra de negócio não é criação.
 */

import type { VisualIdentityDna } from "@/lib/schemas/visual-identity";

// ---------------------------------------------------------------------------
// Papéis
// ---------------------------------------------------------------------------

export const REFERENCE_KINDS = [
  "estilo",
  "layout",
  "tipografia",
  "personagem",
  "produto",
  "textura",
] as const;

export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

/** A logo nunca é escolhida pela IA — entra sempre na posição 0, resolvida do perfil. */
export const REFERENCE_ROLES = ["logo", ...REFERENCE_KINDS] as const;
export type ReferenceRole = (typeof REFERENCE_ROLES)[number];

export function isReferenceKind(value: string): value is ReferenceKind {
  return (REFERENCE_KINDS as readonly string[]).includes(value);
}

export function isReferenceRole(value: string): value is ReferenceRole {
  return (REFERENCE_ROLES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Acervo
// ---------------------------------------------------------------------------

export type ReferenceAsset = {
  id: string;
  kind: ReferenceKind;
  storageUrl: string;
  aiDescription: string | null;
  aiTags: string[];
  usageCount: number;
  lastUsedAt: string | null;
  isWinner: boolean;
};

/** Uma linha do catálogo em texto entregue ao modelo. `token` é `r01`, `r02`… */
export type CatalogEntry = {
  token: string;
  asset: ReferenceAsset;
};

export type ReferenceCatalog = {
  text: string;
  entries: CatalogEntry[];
  byToken: Map<string, ReferenceAsset>;
};

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

export type DirectionNote = {
  note: string;
  source: "steer" | "diff" | "manual";
  hits: number;
};

export type ArtDirectionClient = {
  name: string;
  dna: VisualIdentityDna | null;
  basePrompt: string;
  palette: string[];
  directionNotes: DirectionNote[];
};

export type ArtDirectionDemand = {
  titulo: string | null;
  tipo: string | null;
  instagramCliente?: string | null;
};

export type ArtDirectionArt = {
  index: number;
  headline?: string | null;
  subheadline?: string | null;
  cta?: string | null;
  informacoesExtras?: string | null;
  aspectRatio: string;
  imageSize: string;
};

/** Conceito já escrito para outra arte da MESMA demanda — força diferenciação. */
export type SiblingConcept = {
  index: number;
  concept: string;
};

/**
 * Fotos reais do cliente (painel "Fotos do cliente"). Entram por decisão
 * explícita do operador, por arte — algumas peças pedem o rosto do advogado,
 * a maioria não.
 */
export type ClientPhoto = {
  url: string;
};

export type ArtDirectionInput = {
  client: ArtDirectionClient;
  catalog: ReferenceCatalog;
  demand: ArtDirectionDemand;
  art: ArtDirectionArt;
  siblings: SiblingConcept[];
  /** Vazio quando o operador não pediu as fotos do cliente nesta arte. */
  clientPhotos: ClientPhoto[];
  /** Direção livre do operador ao regenerar: "mais minimalista", "sem pessoas". */
  steer?: string | null;
};

// ---------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------

export type ChosenReference = {
  /** Resolvido de `token` para o id real do asset antes de persistir. */
  assetId: string;
  role: ReferenceRole;
  storageUrl: string;
  /** O papel exato que esta imagem cumpre nesta arte, escrito pela IA. */
  intent: string;
};

export type ArtDirection = {
  concept: string;
  prompt: string;
  negative: string[];
  differentiator: string;
  references: ChosenReference[];
};

/** O que vai para `art_generation_job.direction`. */
export type DirectionMeta = {
  concept: string;
  differentiator: string;
  negative: string[];
  steer: string | null;
  model: string;
  catalogSize: number;
  writtenAt: string;
};
