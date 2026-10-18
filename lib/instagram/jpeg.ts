import sharp from "sharp";

/**
 * Regras de imagem do feed do Instagram: JPEG, até 8MB, largura até 1440px e
 * proporção entre 4:5 e 1.91:1. O navegador gera os JPEGs (canvas); o
 * servidor confere antes de gravar o post.
 */

export const INSTAGRAM_MAX_BYTES = 8 * 1024 * 1024;
export const INSTAGRAM_MAX_WIDTH = 1440;
/** largura / altura: 4:5 (0.8) até 1.91:1. */
export const INSTAGRAM_MIN_RATIO = 4 / 5;
export const INSTAGRAM_MAX_RATIO = 1.91;

export function isInstagramFeedRatio(width: number, height: number): boolean {
  if (!width || !height) return false;
  const ratio = width / height;
  // Tolerância de arredondamento (ex.: 1080×1351 de um export torto).
  return ratio >= INSTAGRAM_MIN_RATIO - 0.005 && ratio <= INSTAGRAM_MAX_RATIO + 0.005;
}

export { feedFormatError } from "./format";

/** Confere um card já gerado. Lança com a mensagem do problema. */
export async function checkInstagramJpeg(buffer: Buffer): Promise<{ width: number; height: number }> {
  if (buffer.byteLength > INSTAGRAM_MAX_BYTES) {
    throw new Error(`Imagem com ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB passa do limite de 8MB do Instagram.`);
  }
  const meta = await sharp(buffer).metadata();
  if (meta.format !== "jpeg") throw new Error("O Instagram só aceita JPEG.");
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width > INSTAGRAM_MAX_WIDTH) throw new Error(`Largura ${width}px passa do máximo de ${INSTAGRAM_MAX_WIDTH}px.`);
  if (!isInstagramFeedRatio(width, height)) {
    throw new Error(`Proporção ${width}×${height} não é aceita no feed do Instagram (de 4:5 a 1.91:1).`);
  }
  return { width, height };
}
