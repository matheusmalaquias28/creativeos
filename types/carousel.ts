import { DEFAULT_FONT_FAMILY } from "@/lib/design/fonts";

export type CarouselFormat = "carousel" | "square" | "stories";
export type PostStyle = "minimal" | "profile" | "creator" | "techviral" | "viralsaas";

// ─── CTA ───────────────────────────────────────────────────────────────────

export type CtaShape = "pill" | "rounded" | "square";
export type CtaAlign = "left" | "center" | "right";

export type CarouselCta = {
  enabled: boolean;
  text: string;
  shape: CtaShape;
  align: CtaAlign;
  bgColor: string;
  textColor: string;
  /** Empty string = no border. */
  borderColor: string;
  fontFamily: string;
  /** Lucide icon id from CTA_ICONS; empty string = no icon. */
  icon: string;
};

export function makeDefaultCta(overrides?: Partial<CarouselCta>): CarouselCta {
  return {
    enabled: false,
    text: "Saiba mais",
    shape: "pill",
    align: "left",
    bgColor: "#ffffff",
    textColor: "#0a0a0a",
    borderColor: "",
    fontFamily: DEFAULT_FONT_FAMILY,
    icon: "ArrowRight",
    ...overrides,
  };
}

// ─── Slide ─────────────────────────────────────────────────────────────────

export type TextVAlign = "top" | "middle" | "bottom";
export type TextHAlign = "left" | "center" | "right";
export type TextPosition = `${TextVAlign}-${TextHAlign}`;

/** Image grid layouts: 1 = single 4:3, 2 = two verticals, 3 = big left + two stacked. */
export type ImageGridLayout = 1 | 2 | 3;

export type CarouselImageGrid = {
  enabled: boolean;
  layout: ImageGridLayout;
  /** Up to 3 slots; index maps to a layout cell. */
  images: (string | null)[];
  /** Original generation prompt per slot (for regenerating). */
  prompts?: (string | null)[];
};

export function makeDefaultImageGrid(): CarouselImageGrid {
  return { enabled: false, layout: 1, images: [null, null, null], prompts: [null, null, null] };
}

/** Number of image slots shown for each layout. */
export const IMAGE_GRID_SLOTS: Record<ImageGridLayout, number> = { 1: 1, 2: 2, 3: 3 };

export type CarouselSlide = {
  id: string;
  titulo: string;
  subtitulo: string;
  /** Rich-text (sanitized HTML) override for the title. Falls back to `titulo`. */
  tituloHtml?: string | null;
  /** Rich-text (sanitized HTML) override for the subtitle. Falls back to `subtitulo`. */
  subtituloHtml?: string | null;
  /** Block-level font family applied to the whole slide text. */
  fonteFamilia?: string;
  /** Position of the whole content block (badge + title + subtitle + CTA). */
  textPos?: TextPosition;
  /** Glassmorphism rectangle around the content block. */
  textGlass?: boolean;
  corFundo: string;
  corTitulo: string;
  corSubtitulo: string;
  tamanhoTitulo: number;
  tamanhoSubtitulo: number;
  imagemFundo?: string | null;
  imagemPosX: number;
  imagemPosY: number;
  imagemZoom: number;
  /** Intensidade (0-100) do overlay sobre a imagem de fundo. */
  overlayOpacidade: number;
  /** Cor do overlay (hex). Default preto. */
  overlayColor?: string;
  /** Extensão vertical do overlay (0-100). Maior = cobre mais o texto. */
  overlayHeight?: number;
  cta?: CarouselCta;
  imageGrid?: CarouselImageGrid;
  /** Original background-image generation prompt (for regenerating). */
  bgPrompt?: string | null;
};

export function makeDefaultSlide(
  overrides?: Partial<CarouselSlide>
): CarouselSlide {
  return {
    id: crypto.randomUUID(),
    titulo: "",
    subtitulo: "",
    tituloHtml: null,
    subtituloHtml: null,
    fonteFamilia: DEFAULT_FONT_FAMILY,
    textPos: "bottom-left",
    textGlass: false,
    imageGrid: makeDefaultImageGrid(),
    bgPrompt: null,
    corFundo: "#0a0a0a",
    corTitulo: "#ffffff",
    corSubtitulo: "#a3a3a3",
    tamanhoTitulo: 96,
    tamanhoSubtitulo: 40,
    imagemPosX: 50,
    imagemPosY: 50,
    imagemZoom: 150,
    overlayOpacidade: 0,
    overlayColor: "#000000",
    overlayHeight: 60,
    ...overrides,
  };
}

// ─── Carousel-level design (badge / numbering / pagination) ──────────────────

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type CarouselBadge = {
  enabled: boolean;
  /** Data URL or storage URL of the client logo. */
  logoUrl: string | null;
  /** Instagram handle, e.g. "@marca". */
  handle: string;
  position: Corner;
};

export type CarouselNumbering = {
  enabled: boolean;
  position: Corner;
};

export type CarouselPagination = {
  enabled: boolean;
  side: "left" | "right";
  color: string;
};

export type CarouselDesign = {
  badge: CarouselBadge;
  numbering: CarouselNumbering;
  pagination: CarouselPagination;
};

export function makeDefaultDesign(
  overrides?: Partial<CarouselDesign>
): CarouselDesign {
  return {
    badge: {
      enabled: false,
      logoUrl: null,
      handle: "@suamarca",
      position: "top-left",
    },
    numbering: {
      enabled: false,
      position: "top-right",
    },
    pagination: {
      enabled: false,
      side: "right",
      color: "#ffffff",
    },
    ...overrides,
  };
}

// ─── Carousel ────────────────────────────────────────────────────────────────

export type Carousel = {
  id: string;
  user_id: string;
  name: string;
  format: CarouselFormat;
  post_style: PostStyle;
  slides: CarouselSlide[];
  design?: CarouselDesign | null;
  created_at: string;
  updated_at: string;
};
