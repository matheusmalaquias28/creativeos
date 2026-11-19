/**
 * Rodapé fixo da marca, aplicado DEPOIS da arte gerada (não passa pela IA):
 * barra de progresso do carrossel + ícone do Instagram, @ e ícones de ação.
 *
 * A IA deixa a faixa de baixo livre (ver `FOOTER_RESERVED_RULE` em prompts.ts);
 * aqui essa faixa é pintada com a cor dominante dela mesma (cobre qualquer
 * coisa que a IA tenha desenhado ali) e o rodapé é desenhado por cima, sempre
 * no mesmo lugar e tamanho em todos os cards.
 */

import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import sharp from "sharp";
import { loadInter } from "./tweet-render";
import { AGENT_CARD_HEIGHT, AGENT_CARD_WIDTH } from "./types";
import {
  FOOTER_BAND_HEIGHT,
  inkFor,
  progressFill,
  PROGRESS_GAP,
  PROGRESS_HEIGHT,
  PROGRESS_WIDTH,
  toHex,
  bandColor,
  type BrandFrameInput,
} from "./brand-frame-layout";

export type { BrandFrameInput } from "./brand-frame-layout";

function Icon({ size, color, children }: { size: number; color: string; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** Aplica o rodapé num card 1080×1350 (PNG/JPEG). Devolve PNG. */
export async function applyBrandFrame(card: Buffer, input: BrandFrameInput): Promise<Buffer> {
  const W = AGENT_CARD_WIDTH;
  const H = AGENT_CARD_HEIGHT;
  const bandTop = H - FOOTER_BAND_HEIGHT;

  const stats = await sharp(card)
    .extract({ left: 0, top: bandTop, width: W, height: FOOTER_BAND_HEIGHT })
    .stats();
  const bandRgb = bandColor(stats);
  const band = toHex(bandRgb);
  const ink = inkFor(bandRgb, input.palette);
  const showProgress = input.total > 1;
  const fill = progressFill(input.index, input.total);
  const rest = PROGRESS_WIDTH - fill - PROGRESS_GAP;
  const handle = input.handle?.trim() ? `@${input.handle.trim().replace(/^@+/, "")}` : null;

  const [regular, bold] = await Promise.all([loadInter(400), loadInter(700)]);
  const fonts = [
    ...(regular ? [{ name: "Inter", data: regular, weight: 400 as const, style: "normal" as const }] : []),
    ...(bold ? [{ name: "Inter", data: bold, weight: 700 as const, style: "normal" as const }] : []),
  ];

  const overlay = new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: FOOTER_BAND_HEIGHT,
          background: band,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
          fontFamily: fonts.length ? "Inter" : undefined,
        }}
      >
        {showProgress ? (
          <div style={{ display: "flex", width: PROGRESS_WIDTH, height: PROGRESS_HEIGHT, gap: rest > 0 ? PROGRESS_GAP : 0 }}>
            <div style={{ display: "flex", width: fill, height: PROGRESS_HEIGHT, borderRadius: 4, background: input.accent }} />
            {rest > 0 ? (
              <div style={{ display: "flex", width: rest, height: PROGRESS_HEIGHT, borderRadius: 4, background: ink, opacity: 0.85 }} />
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", gap: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                width: 46,
                height: 46,
                borderRadius: 23,
                background: ink,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={26} color={band}>
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </Icon>
            </div>
            {handle ? <span style={{ fontSize: 28, fontWeight: 400, color: ink }}>{handle}</span> : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Icon size={38} color={ink}>
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </Icon>
            <Icon size={38} color={ink}>
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
            </Icon>
            <Icon size={38} color={ink}>
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </Icon>
            <Icon size={38} color={ink}>
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
            </Icon>
          </div>
        </div>
      </div>
    ),
    { width: W, height: FOOTER_BAND_HEIGHT, fonts: fonts.length ? fonts : undefined }
  );
  const footer = Buffer.from(await overlay.arrayBuffer());

  return sharp(card)
    .composite([{ input: footer, left: 0, top: bandTop }])
    .png()
    .toBuffer();
}
