import sharp from "sharp";
import { toInstagramJpeg } from "@/lib/instagram/jpeg";
import { applyBrandFrame } from "./brand-frame";
import type { BrandFrameInput } from "./brand-frame-layout";
import { applyLogo, type LogoApplyInput } from "./logo";
import { AGENT_CARD_HEIGHT, AGENT_CARD_WIDTH } from "./types";

/**
 * Arte gerada → card final do feed: 1080×1350 (cobrindo, sem distorcer) e JPEG
 * no padrão que o Instagram aceita, com a logo (versão escolhida pelo contraste)
 * e o rodapé fixo da marca aplicados em código (a IA deixa essas áreas livres).
 */
export async function finalizeCard(
  art: Buffer,
  opts: { frame?: BrandFrameInput | null; logo?: LogoApplyInput | null } = {}
): Promise<Buffer> {
  const { frame, logo } = opts;
  let canvas: Buffer = await sharp(art)
    .resize(AGENT_CARD_WIDTH, AGENT_CARD_HEIGHT, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
  if (logo) {
    // Logo colada em código, versão escolhida pela cor do fundo embaixo dela.
    canvas = await applyLogo(canvas, logo).catch((e) => {
      console.error("[carousel-agent] logo não aplicada", e instanceof Error ? e.message : e);
      return canvas;
    });
  }
  if (frame) {
    // Rodapé fixo (barra de progresso, @, ícones) desenhado em código, igual em todos os cards.
    canvas = await applyBrandFrame(canvas, frame).catch((e) => {
      console.error("[carousel-agent] rodapé não aplicado", e instanceof Error ? e.message : e);
      return canvas;
    });
  }
  const { buffer } = await toInstagramJpeg(canvas, 90);
  return buffer;
}

export async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Falha ao baixar ${url} (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
