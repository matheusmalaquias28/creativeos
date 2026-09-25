/**
 * Imagens para os passos com visão do Claude (direção e revisão de arte).
 * Reduz para ~1000px no lado maior em JPEG — suficiente para ler composição e
 * tipografia, e mantém o custo por referência baixo.
 */

import sharp from "sharp";
import type Anthropic from "@anthropic-ai/sdk";

const MAX_SIDE = 1000;

export async function bufferToVisionBlock(
  buffer: Buffer,
  maxSide = MAX_SIDE
): Promise<Anthropic.Messages.ImageBlockParam> {
  const jpeg = await sharp(buffer)
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85 })
    .toBuffer();
  return {
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") },
  };
}

export async function urlToVisionBlock(
  url: string,
  maxSide = MAX_SIDE
): Promise<Anthropic.Messages.ImageBlockParam | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await bufferToVisionBlock(Buffer.from(await res.arrayBuffer()), maxSide);
  } catch {
    return null;
  }
}
