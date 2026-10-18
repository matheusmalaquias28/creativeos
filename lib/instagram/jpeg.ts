import sharp from "sharp";

/**
 * Converte as páginas exportadas do Studio (PNG) no que o Instagram aceita:
 * JPEG sRGB, até 8MB, largura até 1440px e proporção entre 4:5 e 1.91:1.
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

export type InstagramJpeg = { buffer: Buffer; width: number; height: number };

export async function toInstagramJpeg(input: Buffer, quality = 90): Promise<InstagramJpeg> {
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!isInstagramFeedRatio(width, height)) {
    throw new Error(
      `Proporção ${width}×${height} não é aceita no feed do Instagram (precisa ficar entre 4:5 e 1.91:1).`
    );
  }

  const buffer = await sharp(input)
    .rotate()
    .resize({ width: INSTAGRAM_MAX_WIDTH, withoutEnlargement: true })
    // PNG com transparência vira fundo branco (JPEG não tem alpha).
    .flatten({ background: "#ffffff" })
    .toColorspace("srgb")
    .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();

  if (buffer.byteLength > INSTAGRAM_MAX_BYTES) {
    throw new Error(`JPEG com ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB passa do limite de 8MB do Instagram.`);
  }
  const out = await sharp(buffer).metadata();
  return { buffer, width: out.width ?? width, height: out.height ?? height };
}
