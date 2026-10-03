/** Padrão único de geração de imagem — CreativeOS usa feed vertical (3:4). */
export const IMAGE_GEN_DEFAULTS = {
  aspectRatio: "3:4",
  imageSize: "2K",
  /**
   * Campo legado — o provider real é escolhido por IMAGE_PROVIDER (ver
   * provider.ts); o worker IGNORA este `model`. Mantido só porque o shape dos
   * nodes/params ainda o carrega. O Space usa OpenAI `gpt-image-2`.
   */
  model: "gpt-image-2",
  quality: "low" as const,
} as const;

export type ImageGenQuality = (typeof IMAGE_GEN_DEFAULTS)["quality"];
