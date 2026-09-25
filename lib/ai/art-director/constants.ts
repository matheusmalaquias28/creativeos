/**
 * Formato único da camada de direção de arte.
 *
 * 3:4 SEMPRE, por decisão de produto. Ignora deliberadamente
 * `client_creative_profile.aspect_ratio` (que nasce '1:1' por default antigo) e
 * qualquer `aspectRatio` que venha na arte do webhook do Make — as duas origens
 * já produziram arte fora do formato de feed.
 */
export const ART_ASPECT_RATIO = "3:4" as const;

/** Resolução padrão. Esta sim continua configurável por cliente. */
export const ART_IMAGE_SIZE_FALLBACK = "2K" as const;

/** Proporção como fração CSS, para os containers de imagem. */
export const ART_ASPECT_CLASS = "aspect-[3/4]" as const;
