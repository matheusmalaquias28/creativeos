import { DEFAULT_FONT_FAMILY, FONT_OPTIONS } from "@/lib/design/fonts";

/** Imagem de referência do perfil (guia as imagens de fundo dos carrosséis). */
export type ProfileReferenceImage = {
  url: string;
  storage_path: string;
};

export type CarouselProfile = {
  id: string;
  user_id: string;
  client_id: string | null;
  name: string;
  logo_url: string | null;
  logo_storage_path: string | null;
  font_title: string | null;
  font_body: string | null;
  color_background: string;
  color_title: string;
  color_subtitle: string;
  color_accent: string;
  palette: string[];
  /** Referências visuais usadas para gerar as imagens de fundo. */
  reference_images: ProfileReferenceImage[];
  instagram_handle: string | null;
  /** Raw business/brand context typed by the user. */
  business_context: string | null;
  /** AI-generated markdown context read by the Gerador Turbo. */
  context_md: string | null;
  created_at: string;
  updated_at: string;
};

/** Draft shape used by the editor before persisting. */
export type CarouselProfileDraft = Omit<
  CarouselProfile,
  "user_id" | "created_at" | "updated_at"
>;

export function makeEmptyProfileDraft(): CarouselProfileDraft {
  return {
    id: "",
    client_id: null,
    name: "Novo Perfil",
    logo_url: null,
    logo_storage_path: null,
    font_title: FONT_OPTIONS[0].family,
    font_body: DEFAULT_FONT_FAMILY,
    color_background: "#0a0a0a",
    color_title: "#ffffff",
    color_subtitle: "#a3a3a3",
    color_accent: "#3b82f6",
    palette: [],
    reference_images: [],
    instagram_handle: null,
    business_context: null,
    context_md: null,
  };
}
