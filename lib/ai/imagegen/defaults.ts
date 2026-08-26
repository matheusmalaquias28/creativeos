/** Padrão único de geração de imagem — CreativeOS usa feed vertical (3:4). */
export const IMAGE_GEN_DEFAULTS = {
  aspectRatio: "3:4",
  imageSize: "2K",
  /** Slug Magnific (images_generate.mode) ou "gemini" para o pipeline Gemini. */
  model: "gpt-2",
  quality: "low" as const,
} as const;

export type ImageGenQuality = (typeof IMAGE_GEN_DEFAULTS)["quality"];
