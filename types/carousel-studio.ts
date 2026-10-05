/**
 * Carrossel Studio — documento em camadas (estilo Figma).
 *
 * Coordenadas em pixels do tamanho real da peça (ex.: 1080×1350). Cada camada
 * tem caixa própria (x, y, width, height) e rotação em graus em torno do
 * centro. A ordem do array é a ordem de empilhamento: o último fica na frente.
 *
 * A IA só produz IMAGENS sem texto (fundo e elementos recortados). Texto,
 * botão, formas e logo são sempre camadas de código — tudo editável.
 */

export const STUDIO_FORMATS = {
  "4:5": { width: 1080, height: 1350, label: "Feed 4:5" },
  "1:1": { width: 1080, height: 1080, label: "Quadrado 1:1" },
  "9:16": { width: 1080, height: 1920, label: "Stories 9:16" },
} as const;

export type StudioFormat = keyof typeof STUDIO_FORMATS;

export function isStudioFormat(value: unknown): value is StudioFormat {
  return value === "4:5" || value === "1:1" || value === "9:16";
}

// ─── Preenchimentos ──────────────────────────────────────────────────────────

export type StudioGradientStop = {
  color: string;
  /** 0–1 */
  opacity: number;
  /** Posição 0–100 (%). */
  at: number;
};

export type StudioGradient = {
  /** Ângulo CSS (180 = de cima para baixo). */
  angle: number;
  stops: StudioGradientStop[];
};

// ─── Camadas ─────────────────────────────────────────────────────────────────

type LayerBase = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Graus, sentido horário, em torno do centro. */
  rotation: number;
  /** 0–1 */
  opacity: number;
  locked?: boolean;
  hidden?: boolean;
};

export type StudioImageRole = "background" | "element" | "photo" | "logo";

export type StudioImageLayer = LayerBase & {
  type: "image";
  src: string | null;
  role: StudioImageRole;
  fit: "cover" | "contain";
  /** Ponto focal (0–100) — equivale ao object-position. */
  focusX: number;
  focusY: number;
  /** 1 = 100%. Só vale para `cover`. */
  zoom: number;
  radius: number;
  flipX?: boolean;
  /** Filtros CSS (100 = neutro; blur em px). */
  brightness?: number;
  contrast?: number;
  saturate?: number;
  blur?: number;
  shadow?: boolean;
  /** Prompt que gerou a imagem — base para "gerar de novo". */
  prompt?: string | null;
  /** Estado de geração pela IA (não persiste depois de pronto). */
  status?: "generating" | "failed" | null;
  error?: string | null;
};

export type StudioTextAlign = "left" | "center" | "right";

export type StudioTextLayer = LayerBase & {
  type: "text";
  /** Texto puro. Trechos entre *asteriscos* saem na cor de destaque. */
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  accentColor: string;
  align: StudioTextAlign;
  lineHeight: number;
  /** Em px. */
  letterSpacing: number;
  uppercase: boolean;
  italic: boolean;
  /** Altura acompanha o conteúdo (a caixa só define largura). */
  autoHeight: boolean;
  shadow?: boolean;
  /** Marca-texto atrás dos trechos em destaque (null = sem). */
  highlight?: string | null;
};

export type StudioShapeLayer = LayerBase & {
  type: "shape";
  shape: "rect" | "ellipse";
  fill: string;
  gradient?: StudioGradient | null;
  stroke: string | null;
  strokeWidth: number;
  radius: number;
};

export type StudioButtonLayer = LayerBase & {
  type: "button";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  fill: string;
  stroke: string | null;
  strokeWidth: number;
  radius: number;
  /** Id de ícone Lucide de CTA_ICONS; null = sem ícone. */
  icon: string | null;
  uppercase: boolean;
};

export type StudioLayer =
  | StudioImageLayer
  | StudioTextLayer
  | StudioShapeLayer
  | StudioButtonLayer;

export type StudioLayerType = StudioLayer["type"];

export type StudioPage = {
  id: string;
  name: string;
  background: string;
  gradient?: StudioGradient | null;
  layers: StudioLayer[];
};

export type StudioDocument = {
  version: 1;
  format: StudioFormat;
  width: number;
  height: number;
  pages: StudioPage[];
};

export function makeEmptyDocument(format: StudioFormat = "4:5"): StudioDocument {
  const size = STUDIO_FORMATS[format];
  return { version: 1, format, width: size.width, height: size.height, pages: [] };
}

export function isStudioDocument(value: unknown): value is StudioDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as Partial<StudioDocument>;
  return doc.version === 1 && Array.isArray(doc.pages) && typeof doc.width === "number";
}

// ─── Kit de marca (ficha do cliente) ─────────────────────────────────────────

export type StudioBrandKit = {
  clientId: string | null;
  clientName: string;
  logoUrl: string | null;
  handle: string;
  /** Paleta da ficha (hex), na ordem de importância. */
  palette: string[];
  /** Fontes do perfil de design do cliente, se houver (font-family CSS). */
  fontHeading: string | null;
  fontBody: string | null;
  /** DNA visual resumido em texto (estilo, composição, mood…). */
  styleNotes: string;
  /** Contexto de negócio / tom de voz. */
  businessContext: string;
  /** Referências visuais da ficha (URLs públicas). */
  referenceUrls: string[];
};

// ─── Geração ────────────────────────────────────────────────────────────────

export type StudioStatus = "idle" | "queued" | "generating" | "ready" | "failed";

export type StudioGenerationStage = "queued" | "planning" | "images" | "done" | "failed";

export type StudioGeneration = {
  runId?: string;
  stage?: StudioGenerationStage;
  message?: string;
  done?: number;
  total?: number;
  error?: string | null;
  startedAt?: string;
  finishedAt?: string;
};

export type StudioCarousel = {
  id: string;
  demand_id: string | null;
  client_id: string | null;
  user_id: string | null;
  name: string;
  format: StudioFormat;
  status: StudioStatus;
  document: StudioDocument;
  brand: Partial<StudioBrandKit>;
  reference_urls: string[];
  brief: string | null;
  caption: string | null;
  generation: StudioGeneration;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
};

export function isStudioBusy(status: StudioStatus): boolean {
  return status === "queued" || status === "generating";
}
