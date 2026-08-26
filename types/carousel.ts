export type CarouselFormat = "carousel" | "square" | "stories";
export type PostStyle = "minimal" | "profile" | "creator" | "techviral" | "viralsaas";

export type CarouselSlide = {
  id: string;
  titulo: string;
  subtitulo: string;
  corFundo: string;
  corTitulo: string;
  corSubtitulo: string;
  tamanhoTitulo: number;
  tamanhoSubtitulo: number;
  imagemFundo?: string | null;
  imagemPosX: number;
  imagemPosY: number;
  imagemZoom: number;
  overlayOpacidade: number;
};

export type Carousel = {
  id: string;
  user_id: string;
  name: string;
  format: CarouselFormat;
  post_style: PostStyle;
  slides: CarouselSlide[];
  created_at: string;
  updated_at: string;
};

export function makeDefaultSlide(
  overrides?: Partial<CarouselSlide>
): CarouselSlide {
  return {
    id: crypto.randomUUID(),
    titulo: "",
    subtitulo: "",
    corFundo: "#0a0a0a",
    corTitulo: "#ffffff",
    corSubtitulo: "#a3a3a3",
    tamanhoTitulo: 96,
    tamanhoSubtitulo: 40,
    imagemPosX: 50,
    imagemPosY: 50,
    imagemZoom: 150,
    overlayOpacidade: 0,
    ...overrides,
  };
}
