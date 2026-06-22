/**
 * Composição de logo sobre arte gerada usando `sharp`.
 * Estratégia `composite`: o modelo gera a arte de fundo; o logo original
 * é sobreposto em posição/tamanho determinísticos definidos no perfil do cliente.
 */

import sharp from "sharp";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogoPlacement = {
  /** Largura do logo em pixels ou porcentagem da arte (ex: 0.25 = 25%) */
  widthPx?: number;
  widthRatio?: number;
  /** Posição (px a partir do canto) */
  top?: number;
  left?: number;
  bottom?: number;
  right?: number;
  /** Margem padrão quando posição não especificada */
  marginPx?: number;
};

export type CompositeLogoParams = {
  /** PNG/JPEG da arte gerada (Buffer) */
  artBuffer: Buffer;
  /** Buffer do arquivo de logo original */
  logoBuffer: Buffer;
  placement: LogoPlacement;
};

// ---------------------------------------------------------------------------
// compositeLogoPng
// ---------------------------------------------------------------------------

export async function compositeLogoPng(
  params: CompositeLogoParams
): Promise<Buffer> {
  const { artBuffer, logoBuffer, placement } = params;

  const artMeta = await sharp(artBuffer).metadata();
  const artWidth = artMeta.width ?? 1024;
  const artHeight = artMeta.height ?? 1024;

  // Calcula largura final do logo
  let targetWidth: number;
  if (placement.widthPx) {
    targetWidth = placement.widthPx;
  } else if (placement.widthRatio) {
    targetWidth = Math.round(artWidth * placement.widthRatio);
  } else {
    targetWidth = Math.round(artWidth * 0.2); // default: 20% da largura
  }

  // Redimensiona logo mantendo aspect ratio
  const resizedLogo = await sharp(logoBuffer)
    .resize({ width: targetWidth, withoutEnlargement: false })
    .png()
    .toBuffer();

  const logoMeta = await sharp(resizedLogo).metadata();
  const logoWidth = logoMeta.width ?? targetWidth;
  const logoHeight = logoMeta.height ?? targetWidth;

  const margin = placement.marginPx ?? 24;

  // Calcula posição (top/left absolutos)
  let top: number;
  let left: number;

  if (placement.top !== undefined) {
    top = placement.top;
  } else if (placement.bottom !== undefined) {
    top = artHeight - logoHeight - placement.bottom;
  } else {
    top = artHeight - logoHeight - margin; // default: canto inferior
  }

  if (placement.left !== undefined) {
    left = placement.left;
  } else if (placement.right !== undefined) {
    left = artWidth - logoWidth - placement.right;
  } else {
    left = margin; // default: canto esquerdo
  }

  const result = await sharp(artBuffer)
    .composite([{ input: resizedLogo, top: Math.max(0, top), left: Math.max(0, left) }])
    .png()
    .toBuffer();

  return result;
}

/**
 * Converte base64 de arte + base64 de logo → base64 composto (PNG).
 */
export async function compositeLogoFromBase64(params: {
  artBase64: string;
  artMimeType: string;
  logoBase64: string;
  logoMimeType: string;
  placement: LogoPlacement;
}): Promise<{ base64: string; mimeType: string }> {
  const artBuffer = Buffer.from(params.artBase64, "base64");
  const logoBuffer = Buffer.from(params.logoBase64, "base64");

  const composited = await compositeLogoPng({
    artBuffer,
    logoBuffer,
    placement: params.placement,
  });

  return { base64: composited.toString("base64"), mimeType: "image/png" };
}
