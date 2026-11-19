import sharp from "sharp";
import { toInstagramJpeg } from "@/lib/instagram/jpeg";
import { AGENT_CARD_HEIGHT, AGENT_CARD_WIDTH } from "./types";
import { LOGO_AREA } from "./prompts";

/**
 * Arte gerada → card final do feed: 1080×1350 (cobrindo, sem distorcer), logo
 * colada no canto superior esquerdo (dentro da área que o prompt deixou livre)
 * e JPEG no padrão que o Instagram aceita.
 */
export async function finalizeCard(art: Buffer, logo: Buffer | null): Promise<Buffer> {
  let canvas = await sharp(art)
    .resize(AGENT_CARD_WIDTH, AGENT_CARD_HEIGHT, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  if (logo) {
    const boxW = Math.round(AGENT_CARD_WIDTH * LOGO_AREA.widthRatio);
    const boxH = Math.round(AGENT_CARD_HEIGHT * LOGO_AREA.heightRatio);
    const margin = Math.round(AGENT_CARD_WIDTH * LOGO_AREA.marginRatio);
    const resized = await sharp(logo)
      .resize({ width: boxW, height: boxH, fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
    canvas = await sharp(canvas)
      .composite([{ input: resized, top: margin, left: margin }])
      .png()
      .toBuffer();
  }

  const { buffer } = await toInstagramJpeg(canvas, 90);
  return buffer;
}

export async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Falha ao baixar ${url} (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
