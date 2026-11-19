import sharp from "sharp";
import { toInstagramJpeg } from "@/lib/instagram/jpeg";
import { AGENT_CARD_HEIGHT, AGENT_CARD_WIDTH } from "./types";

/**
 * Arte gerada → card final do feed: 1080×1350 (cobrindo, sem distorcer) e JPEG
 * no padrão que o Instagram aceita. A logo não é colada aqui: ela vai como
 * referência e a IA aplica na arte (colada por cima, logos com fundo branco
 * ficavam com um retângulo branco).
 */
export async function finalizeCard(art: Buffer): Promise<Buffer> {
  const canvas = await sharp(art)
    .resize(AGENT_CARD_WIDTH, AGENT_CARD_HEIGHT, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
  const { buffer } = await toInstagramJpeg(canvas, 90);
  return buffer;
}

export async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Falha ao baixar ${url} (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
