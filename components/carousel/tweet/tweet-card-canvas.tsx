"use client";

import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { stripUnsafeHtml } from "@/lib/carousel/sanitize-html";
import { TWEET_FONT_MAX, TWEET_FONT_MIN } from "@/lib/carousel/tweet/format";
import {
  TWEET_CANVAS,
  type TweetCard,
  type TweetProfileSnapshot,
  type TweetTheme,
} from "@/types/tweet-carousel";

const PAD_X = 80;
const PAD_Y = 90;
const IMAGE_HEIGHT = 440;
const FONT_STACK =
  'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

const THEMES: Record<TweetTheme, { bg: string; text: string; muted: string; ring: string }> = {
  light: { bg: "#ffffff", text: "#0f1419", muted: "#536471", ring: "#e1e8ed" },
  dark: { bg: "#000000", text: "#e7e9ea", muted: "#71767b", ring: "#2f3336" },
};

export function VerifiedBadge({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Verificado" style={{ flexShrink: 0 }}>
      <path
        fill="#1d9bf0"
        d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81C14.67 2.63 13.43 1.75 12 1.75s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.9 2.19 3.34 2.19s2.68-.88 3.33-2.19c1.4.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
      />
      <path fill="#ffffff" d="M9.99 16.6 6.4 13.01l1.41-1.41 2.18 2.18 5.2-5.2 1.41 1.41z" />
    </svg>
  );
}

type CanvasProps = {
  card: TweetCard;
  profile: TweetProfileSnapshot;
  theme: TweetTheme;
};

/**
 * Card no tamanho real (1080×1350). Todo o layout é feito em código: a IA só
 * escreve o texto. Quando `card.fontSize` é null, o texto encolhe até caber.
 */
export const TweetCardCanvas = forwardRef<HTMLDivElement, CanvasProps>(function TweetCardCanvas(
  { card, profile, theme },
  ref
) {
  const colors = THEMES[theme];
  const blockRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [autoSize, setAutoSize] = useState(TWEET_FONT_MAX);
  const [fontsTick, setFontsTick] = useState(0);

  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && setFontsTick((t) => t + 1));
    return () => {
      alive = false;
    };
  }, []);

  // Autoajuste: mede no DOM e desce o tamanho até o bloco caber no canvas.
  useLayoutEffect(() => {
    if (card.fontSize != null) return;
    const block = blockRef.current;
    const body = bodyRef.current;
    if (!block || !body) return;
    const available = TWEET_CANVAS.height - PAD_Y * 2;
    let size = TWEET_FONT_MAX;
    body.style.fontSize = `${size}px`;
    while (block.scrollHeight > available && size > TWEET_FONT_MIN) {
      size -= 2;
      body.style.fontSize = `${size}px`;
    }
    setAutoSize(size);
  }, [card.html, card.imageUrl, card.fontSize, fontsTick]);

  const fontSize = card.fontSize ?? autoSize;
  const avatar = 104;

  return (
    <div
      ref={ref}
      style={{
        width: TWEET_CANVAS.width,
        height: TWEET_CANVAS.height,
        background: colors.bg,
        color: colors.text,
        fontFamily: FONT_STACK,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: `${PAD_Y}px ${PAD_X}px`,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div ref={blockRef} style={{ display: "flex", flexDirection: "column" }}>
        {/* Cabeçalho do "tweet" */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              crossOrigin="anonymous"
              width={avatar}
              height={avatar}
              style={{
                width: avatar,
                height: avatar,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: avatar,
                height: avatar,
                borderRadius: "50%",
                background: colors.ring,
                color: colors.muted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 44,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {profile.name.trim().charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  fontSize: 38,
                  fontWeight: 700,
                  lineHeight: 1.15,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {profile.name || "Seu nome"}
              </span>
              <VerifiedBadge size={38} />
            </div>
            <span style={{ fontSize: 31, color: colors.muted, lineHeight: 1.2 }}>
              {profile.handle || "@seuperfil"}
            </span>
          </div>
        </div>

        {/* Texto */}
        <div
          ref={bodyRef}
          className="tweet-card-body"
          style={{
            marginTop: 44,
            fontSize,
            lineHeight: 1.38,
            letterSpacing: "-0.005em",
            overflowWrap: "break-word",
            whiteSpace: "normal",
          }}
          dangerouslySetInnerHTML={{ __html: stripUnsafeHtml(card.html) }}
        />

        {card.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.imageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              marginTop: 48,
              width: "100%",
              height: IMAGE_HEIGHT,
              objectFit: "cover",
              borderRadius: 28,
              border: `1px solid ${colors.ring}`,
              flexShrink: 0,
            }}
          />
        )}
      </div>
    </div>
  );
});

/** Prévia escalada do canvas para caber na largura do container. */
export function TweetCardPreview({
  card,
  profile,
  theme,
  className,
}: CanvasProps & { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / TWEET_CANVAS.width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio: "4 / 5", overflow: "hidden" }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <TweetCardCanvas card={card} profile={profile} theme={theme} />
      </div>
    </div>
  );
}
