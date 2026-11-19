import sharp from "sharp";
import { toInstagramJpeg } from "@/lib/instagram/jpeg";
import { applyBrandFrame } from "./brand-frame";
import { FOOTER_BAND_HEIGHT, type BrandFrameInput } from "./brand-frame-layout";
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
  let canvas: Buffer = frame
    ? await withFooterBand(art)
    : await sharp(art)
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

/**
 * Com rodapé: a arte (gerada em 9:10) ocupa a parte de cima, 1080×1200, e a
 * faixa do rodapé é acrescentada embaixo com a cor da borda de baixo da arte.
 */
async function withFooterBand(art: Buffer): Promise<Buffer> {
  const artHeight = AGENT_CARD_HEIGHT - FOOTER_BAND_HEIGHT;
  const top = await sharp(art)
    .resize(AGENT_CARD_WIDTH, artHeight, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
  const edge = await sharp(top)
    .extract({ left: 0, top: artHeight - 6, width: AGENT_CARD_WIDTH, height: 6 })
    .stats();
  const [r, g, b] = edge.channels.map((c) => Math.round(c.mean));
  return sharp(top)
    .extend({ bottom: FOOTER_BAND_HEIGHT, background: { r, g, b, alpha: 1 } })
    .png()
    .toBuffer();
}

export async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Falha ao baixar ${url} (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
