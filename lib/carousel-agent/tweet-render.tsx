/**
 * Card "print de tweet" desenhado no servidor (next/og → PNG), com o mesmo
 * visual do editor do Carrossel Tweet (components/carousel/tweet/tweet-card-canvas).
 * O texto é exato: nada passa por modelo de imagem.
 *
 * Satori não tem texto "inline" com estilos misturados, então cada palavra é
 * um <span> num flex com quebra de linha (layout em tweet-layout.ts).
 */

import { ImageResponse } from "next/og";
import sharp from "sharp";
import { TWEET_CANVAS } from "@/types/tweet-carousel";
import { AVATAR, BODY_GAP, fitTweetFontSize, LINE_HEIGHT, PAD_X, PAD_Y, parseTweetText } from "./tweet-layout";
import type { TweetTheme } from "./types";

const THEMES: Record<TweetTheme, { bg: string; text: string; muted: string; ring: string }> = {
  light: { bg: "#ffffff", text: "#0f1419", muted: "#536471", ring: "#e1e8ed" },
  dark: { bg: "#000000", text: "#e7e9ea", muted: "#71767b", ring: "#2f3336" },
};

// ─── Fontes (Inter do Google Fonts, em cache; cai na Noto do next/og) ────────

const fontCache = new Map<number, Promise<ArrayBuffer | null>>();

export async function loadInter(weight: 400 | 700): Promise<ArrayBuffer | null> {
  if (!fontCache.has(weight)) {
    fontCache.set(
      weight,
      (async () => {
        try {
          const css = await (
            await fetch(`https://fonts.googleapis.com/css2?family=Inter:wght@${weight}`, {
              signal: AbortSignal.timeout(10_000),
            })
          ).text();
          const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
          if (!url) return null;
          const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
          return res.ok ? await res.arrayBuffer() : null;
        } catch {
          return null;
        }
      })()
    );
  }
  const font = await fontCache.get(weight)!;
  if (!font) fontCache.delete(weight); // tenta de novo na próxima
  return font;
}

function VerifiedBadge({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path
        fill="#1d9bf0"
        d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81C14.67 2.63 13.43 1.75 12 1.75s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.9 2.19 3.34 2.19s2.68-.88 3.33-2.19c1.4.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
      />
      <path fill="#ffffff" d="M9.99 16.6 6.4 13.01l1.41-1.41 2.18 2.18 5.2-5.2 1.41 1.41z" />
    </svg>
  );
}

export type TweetCardInput = {
  text: string;
  name: string;
  handle: string;
  /** Foto do perfil já baixada (qualquer formato que o sharp leia). */
  avatar: Buffer | null;
  theme: TweetTheme;
};

/** Desenha o card e devolve PNG 1080×1350. */
export async function renderTweetCard(input: TweetCardInput): Promise<Buffer> {
  const colors = THEMES[input.theme];
  const paragraphs = parseTweetText(input.text);
  const fontSize = fitTweetFontSize(paragraphs);
  const space = Math.round(fontSize * 0.28);

  const avatarSrc = input.avatar
    ? `data:image/png;base64,${(
        await sharp(input.avatar).resize(AVATAR * 2, AVATAR * 2, { fit: "cover" }).png().toBuffer()
      ).toString("base64")}`
    : null;

  const [regular, bold] = await Promise.all([loadInter(400), loadInter(700)]);
  const fonts = [
    ...(regular ? [{ name: "Inter", data: regular, weight: 400 as const, style: "normal" as const }] : []),
    ...(bold ? [{ name: "Inter", data: bold, weight: 700 as const, style: "normal" as const }] : []),
  ];

  const response = new ImageResponse(
    (
      <div
        style={{
          width: TWEET_CANVAS.width,
          height: TWEET_CANVAS.height,
          background: colors.bg,
          color: colors.text,
          fontFamily: fonts.length ? "Inter" : undefined,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: `${PAD_Y}px ${PAD_X}px`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSrc} width={AVATAR} height={AVATAR} style={{ borderRadius: AVATAR / 2 }} alt="" />
          ) : (
            <div
              style={{
                width: AVATAR,
                height: AVATAR,
                borderRadius: AVATAR / 2,
                background: colors.ring,
                color: colors.muted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 44,
                fontWeight: 700,
              }}
            >
              {input.name.trim().charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.15 }}>{input.name}</span>
              <VerifiedBadge size={38} />
            </div>
            <span style={{ fontSize: 31, color: colors.muted, lineHeight: 1.2 }}>{input.handle}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: BODY_GAP,
            gap: Math.round(fontSize * 0.9),
            fontSize,
            lineHeight: LINE_HEIGHT,
          }}
        >
          {paragraphs.map((words, p) => (
            <div key={p} style={{ display: "flex", flexWrap: "wrap", columnGap: space }}>
              {words.map((w, i) => (
                <span key={i} style={{ display: "flex" }}>
                  {w.parts.map((p, j) => (
                    <span key={j} style={{ fontWeight: p.bold ? 700 : 400 }}>
                      {p.text}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: TWEET_CANVAS.width,
      height: TWEET_CANVAS.height,
      fonts: fonts.length ? fonts : undefined,
      emoji: "twemoji",
    }
  );

  return Buffer.from(await response.arrayBuffer());
}
