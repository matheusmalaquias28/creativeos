"use client";

import { cn } from "@/lib/utils";
import { getCtaIcon } from "@/lib/carousel/cta-icons";
import { stripUnsafeHtml, hasRichContent } from "@/lib/carousel/sanitize-html";
import { DEFAULT_FONT_FAMILY } from "@/lib/design/fonts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  Carousel,
  CarouselCta,
  CarouselDesign,
  CarouselFormat,
  CarouselImageGrid,
  CarouselSlide,
  Corner,
} from "@/types/carousel";
import { makeDefaultDesign } from "@/types/carousel";

export const FORMAT_DIMENSIONS: Record<
  CarouselFormat,
  { width: number; height: number }
> = {
  carousel: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  stories: { width: 1080, height: 1920 },
};

export const FORMAT_LABELS: Record<CarouselFormat, string> = {
  carousel: "Carrossel 4:5",
  square: "Quadrado 1:1",
  stories: "Stories 9:16",
};

const CORNER_STYLES: Record<Corner, React.CSSProperties> = {
  "top-left": { top: 56, left: 56 },
  "top-right": { top: 56, right: 56 },
  "bottom-left": { bottom: 56, left: 56 },
  "bottom-right": { bottom: 56, right: 56 },
};

const CTA_RADIUS: Record<CarouselCta["shape"], number> = {
  pill: 9999,
  rounded: 22,
  square: 0,
};

/** Converte hex (#rgb ou #rrggbb) em [r,g,b]; cai para preto se inválido. */
function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex ?? "").replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [0, 0, 0];
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface SlidePreviewProps {
  slide: CarouselSlide;
  format: CarouselFormat;
  design?: CarouselDesign | null;
  index?: number;
  total?: number;
  previewWidth?: number;
  className?: string;
  innerRef?: React.RefObject<HTMLDivElement | null>;
}

/** CTA is always centered at the bottom of the slide. */
function CtaButton({ cta }: { cta: CarouselCta }) {
  const Icon = getCtaIcon(cta.icon);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 96,
        display: "flex",
        justifyContent: "center",
        zIndex: 6,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 16,
          padding: "26px 48px",
          borderRadius: CTA_RADIUS[cta.shape],
          backgroundColor: cta.bgColor,
          color: cta.textColor,
          border: cta.borderColor ? `3px solid ${cta.borderColor}` : "none",
          fontFamily: cta.fontFamily || DEFAULT_FONT_FAMILY,
          fontSize: 36,
          fontWeight: 700,
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        {cta.text}
        {Icon && <Icon style={{ width: 38, height: 38 }} strokeWidth={2.5} />}
      </div>
    </div>
  );
}

const V_JUSTIFY: Record<string, React.CSSProperties["justifyContent"]> = {
  top: "flex-start",
  middle: "center",
  bottom: "flex-end",
};
const H_ALIGN: Record<string, React.CSSProperties["alignItems"]> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};
const H_TEXT_ALIGN: Record<string, React.CSSProperties["textAlign"]> = {
  left: "left",
  center: "center",
  right: "right",
};

/** Badge chip rendered inline at the top of the content block. */
function BadgeInline({ badge }: { badge: CarouselDesign["badge"] }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 18,
          padding: "16px 26px",
          borderRadius: 9999,
          backgroundColor: "rgba(0,0,0,0.38)",
          backdropFilter: "blur(6px)",
        }}
      >
        {badge.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={badge.logoUrl}
            alt="logo"
            style={{ height: 56, width: "auto", maxWidth: 160, objectFit: "contain" }}
            crossOrigin="anonymous"
          />
        )}
        {badge.handle && (
          <span style={{ color: "#ffffff", fontSize: 30, fontWeight: 600, letterSpacing: "-0.01em" }}>
            {badge.handle}
          </span>
        )}
      </div>
    </div>
  );
}

function Numbering({
  numbering,
  index,
  total,
}: {
  numbering: CarouselDesign["numbering"];
  index: number;
  total: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        ...CORNER_STYLES[numbering.position],
        padding: "12px 24px",
        borderRadius: 9999,
        backgroundColor: "rgba(0,0,0,0.32)",
        backdropFilter: "blur(6px)",
        color: "#ffffff",
        fontSize: 30,
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
        zIndex: 5,
      }}
    >
      {String(index + 1).padStart(2, "0")}
      <span style={{ opacity: 0.55 }}> / {String(total).padStart(2, "0")}</span>
    </div>
  );
}

function Pagination({ pagination }: { pagination: CarouselDesign["pagination"] }) {
  const Chevron = pagination.side === "left" ? ChevronLeft : ChevronRight;
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        [pagination.side]: 44,
        width: 88,
        height: 88,
        borderRadius: 9999,
        backgroundColor: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 5,
      }}
    >
      <Chevron style={{ width: 48, height: 48, color: pagination.color }} strokeWidth={2.75} />
    </div>
  );
}

const GRID_GAP = 12;

function GridSlot({ src }: { src: string | null }) {
  if (!src) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.06)",
          border: "1px dashed rgba(255,255,255,0.16)",
          color: "rgba(255,255,255,0.32)",
          fontSize: 26,
          fontWeight: 600,
        }}
      >
        Imagem
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      crossOrigin="anonymous"
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  );
}

function Cell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ overflow: "hidden", borderRadius: 14, ...style }}>{children}</div>
  );
}

/** Image grid positioned opposite to the text block. */
function ImageGrid({
  grid,
  vAlign,
  dims,
}: {
  grid: CarouselImageGrid;
  vAlign: string;
  dims: { width: number; height: number };
}) {
  const regionH = Math.round(dims.height * 0.54);
  const region: React.CSSProperties = {
    position: "absolute",
    left: 48,
    right: 48,
    height: regionH,
    zIndex: 1,
    ...(vAlign === "top" ? { bottom: 48 } : { top: 48 }),
  };
  const imgs = grid.images ?? [];

  if (grid.layout === 1) {
    return (
      <div style={{ ...region, display: "flex", alignItems: "center" }}>
        <Cell style={{ width: "100%", aspectRatio: "4 / 3" }}>
          <GridSlot src={imgs[0] ?? null} />
        </Cell>
      </div>
    );
  }

  if (grid.layout === 2) {
    return (
      <div style={{ ...region, display: "grid", gridTemplateColumns: "1fr 1fr", gap: GRID_GAP }}>
        <Cell><GridSlot src={imgs[0] ?? null} /></Cell>
        <Cell><GridSlot src={imgs[1] ?? null} /></Cell>
      </div>
    );
  }

  // layout 3 — big left + two stacked right
  return (
    <div
      style={{
        ...region,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: GRID_GAP,
      }}
    >
      <Cell style={{ gridColumn: "1", gridRow: "1 / 3" }}><GridSlot src={imgs[0] ?? null} /></Cell>
      <Cell style={{ gridColumn: "2", gridRow: "1" }}><GridSlot src={imgs[1] ?? null} /></Cell>
      <Cell style={{ gridColumn: "2", gridRow: "2" }}><GridSlot src={imgs[2] ?? null} /></Cell>
    </div>
  );
}

export function SlidePreview({
  slide,
  format,
  design,
  index = 0,
  total = 1,
  previewWidth = 270,
  className,
  innerRef,
}: SlidePreviewProps) {
  const dims = FORMAT_DIMENSIONS[format];
  const scale = previewWidth / dims.width;
  const previewHeight = Math.round(dims.height * scale);

  const posX = slide.imagemPosX ?? 50;
  const posY = slide.imagemPosY ?? 50;
  const zoom = slide.imagemZoom ?? 150;
  const fontFamily = slide.fonteFamilia || DEFAULT_FONT_FAMILY;

  const d = design ?? makeDefaultDesign();
  const cta = slide.cta;

  const titleRich = hasRichContent(slide.tituloHtml);
  const subtitleRich = hasRichContent(slide.subtituloHtml);

  const pos = slide.textPos ?? "bottom-left";
  const [vAlign, hAlign] = pos.split("-");
  const glass = slide.textGlass ?? false;
  const grid = slide.imageGrid;
  const ctaVisible = !!(cta?.enabled && cta.text);

  // Layout regions: with a grid, text and image occupy opposite halves (never
  // overlap). A full background image always gets a dark overlay for contrast,
  // darker on the side where the text sits.
  const gridEnabled = !!grid?.enabled;
  const textAtTop = vAlign === "top";
  const gridH = Math.round(dims.height * 0.54);
  const sep = 48 + gridH + 24;
  const rawOverlay = slide.overlayOpacidade ?? 0;
  const overlayAlpha = (slide.imagemFundo ? (rawOverlay > 0 ? rawOverlay : 45) : rawOverlay) / 100;
  const [or, og, ob] = hexToRgb(slide.overlayColor ?? "#000000");
  const oc = (a: number) => `rgba(${or}, ${og}, ${ob}, ${a})`;
  // Extensão vertical: quanto maior, mais o overlay sobe e cobre o texto.
  const h = Math.min(100, Math.max(0, slide.overlayHeight ?? 60));
  const solidStop = Math.round(h * 0.55);
  const overlayBg =
    vAlign === "top"
      ? `linear-gradient(to bottom, ${oc(overlayAlpha)} 0%, ${oc(overlayAlpha)} ${solidStop}%, ${oc(0)} ${h}%)`
      : vAlign === "middle"
      ? `linear-gradient(${oc(overlayAlpha * 0.85)}, ${oc(overlayAlpha * 0.85)})`
      : `linear-gradient(to top, ${oc(overlayAlpha)} 0%, ${oc(overlayAlpha)} ${solidStop}%, ${oc(0)} ${h}%)`;

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden select-none", className)}
      style={{ width: previewWidth, height: previewHeight }}
    >
      <div
        ref={innerRef}
        style={{
          width: dims.width,
          height: dims.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
          overflow: "hidden",
          backgroundColor: slide.corFundo,
          fontFamily,
          ...(slide.imagemFundo
            ? {
                backgroundImage: `url(${slide.imagemFundo})`,
                backgroundSize: `${zoom}%`,
                backgroundPosition: `${posX}% ${posY}%`,
                backgroundRepeat: "no-repeat",
              }
            : {}),
        }}
      >
        {/* Image grid — sits opposite the text block, always behind the text */}
        {grid?.enabled && <ImageGrid grid={grid} vAlign={vAlign} dims={dims} />}

        {/* Mandatory dark overlay for full background images (contrast) */}
        {slide.imagemFundo && (
          <div style={{ position: "absolute", inset: 0, zIndex: 2, background: overlayBg }} />
        )}

        {/* Numbering + pagination keep their own independent positions */}
        {d.numbering.enabled && (
          <Numbering numbering={d.numbering} index={index} total={total} />
        )}
        {d.pagination.enabled && <Pagination pagination={d.pagination} />}

        {/* Content block — badge + title + subtitle, always above the image.
            With a grid, it's confined to the half opposite the grid. */}
        <div
          style={{
            position: "absolute",
            ...(gridEnabled
              ? textAtTop
                ? { top: 0, left: 0, right: 0, bottom: sep }
                : { top: sep, left: 0, right: 0, bottom: 0 }
              : { inset: 0 }),
            paddingTop: 96,
            paddingLeft: 72,
            paddingRight: 72,
            paddingBottom: ctaVisible ? 240 : 96,
            display: "flex",
            flexDirection: "column",
            justifyContent: V_JUSTIFY[vAlign],
            alignItems: H_ALIGN[hAlign],
            zIndex: 3,
          }}
        >
          <div
            style={{
              maxWidth: "100%",
              textAlign: H_TEXT_ALIGN[hAlign],
              ...(glass
                ? {
                    padding: 56,
                    borderRadius: 32,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    border: "1px solid rgba(255,255,255,0.18)",
                  }
                : {}),
            }}
          >
          {d.badge.enabled && index === 0 && <BadgeInline badge={d.badge} />}
          {titleRich ? (
            <div
              style={{
                color: slide.corTitulo,
                fontSize: slide.tamanhoTitulo,
                fontWeight: 800,
                lineHeight: 1.05,
                margin: 0,
                marginBottom: 24,
                letterSpacing: "-0.02em",
                wordBreak: "break-word",
              }}
              dangerouslySetInnerHTML={{ __html: stripUnsafeHtml(slide.tituloHtml!) }}
            />
          ) : slide.titulo ? (
            <div
              style={{
                color: slide.corTitulo,
                fontSize: slide.tamanhoTitulo,
                fontWeight: 800,
                lineHeight: 1.05,
                margin: 0,
                marginBottom: 24,
                letterSpacing: "-0.02em",
                wordBreak: "break-word",
              }}
            >
              {slide.titulo}
            </div>
          ) : (
            <div
              style={{
                color: "rgba(255,255,255,0.15)",
                fontSize: slide.tamanhoTitulo,
                fontWeight: 800,
                lineHeight: 1.05,
                margin: 0,
                marginBottom: 24,
                letterSpacing: "-0.02em",
              }}
            >
              Título do slide
            </div>
          )}

          {subtitleRich ? (
            <div
              style={{
                color: slide.corSubtitulo,
                fontSize: slide.tamanhoSubtitulo,
                fontWeight: 400,
                lineHeight: 1.5,
                margin: 0,
                wordBreak: "break-word",
              }}
              dangerouslySetInnerHTML={{ __html: stripUnsafeHtml(slide.subtituloHtml!) }}
            />
          ) : (
            slide.subtitulo && (
              <div
                style={{
                  color: slide.corSubtitulo,
                  fontSize: slide.tamanhoSubtitulo,
                  fontWeight: 400,
                  lineHeight: 1.5,
                  margin: 0,
                  wordBreak: "break-word",
                }}
              >
                {slide.subtitulo}
              </div>
            )
          )}

          </div>
        </div>

        {/* CTA — always centered at the bottom */}
        {ctaVisible && <CtaButton cta={cta!} />}
      </div>
    </div>
  );
}

/** Convenience re-export type alias used by callers. */
export type { Carousel };
