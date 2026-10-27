"use client";

import { renderFrameToBlob } from "@/components/carousel-studio/export";

/** Largura máxima que o Instagram aceita; o Studio exporta 1080. */
const MAX_WIDTH = 1440;

/**
 * Renderiza a página (mesmo `renderFrameToBlob` da exportação PNG do Studio) e
 * converte para JPEG no canvas, com fundo branco no lugar da transparência.
 */
export async function renderNodeToJpeg(node: HTMLElement, width: number, height: number, quality = 0.92): Promise<Blob> {
  const png = await renderFrameToBlob(node, width, height);
  const bitmap = await createImageBitmap(png);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu gerar a imagem");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!jpeg) throw new Error("Falha ao gerar o JPEG da página");
  return jpeg;
}
