"use client";

import { memo, type CSSProperties, type ReactNode } from "react";
import { ImageIcon, Loader2, TriangleAlert } from "lucide-react";
import { CTA_ICONS } from "@/lib/carousel/cta-icons";
import { withAlpha } from "@/lib/carousel-studio/color";
import type {
  StudioButtonLayer,
  StudioGradient,
  StudioImageLayer,
  StudioLayer,
  StudioPage,
  StudioShapeLayer,
  StudioTextLayer,
} from "@/types/carousel-studio";

/**
 * Renderiza uma página do Studio em tamanho real (px do documento).
 *
 * É a fonte única da verdade visual: o canvas do editor, as miniaturas e a
 * exportação PNG usam este mesmo componente — o que se vê é o que se exporta.
 */

export function gradientCss(gradient: StudioGradient | null | undefined): string | undefined {
  if (!gradient || gradient.stops.length === 0) return undefined;
  const stops = [...gradient.stops]
    .sort((a, b) => a.at - b.at)
    .map((s) => `${withAlpha(s.color, s.opacity)} ${s.at}%`)
    .join(", ");
  return `linear-gradient(${gradient.angle}deg, ${stops})`;
}

/** Texto com trechos *em destaque* na cor de acento. */
export function AccentText({ layer }: { layer: StudioTextLayer }) {
  const parts = layer.text.split(/(\*[^*\n]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
          const style: CSSProperties = { color: layer.accentColor };
          if (layer.highlight) {
            style.background = layer.highlight;
            style.padding = "0 0.12em";
            style.boxDecorationBreak = "clone";
            style.WebkitBoxDecorationBreak = "clone";
            style.borderRadius = "0.08em";
          }
          return (
            <span key={i} style={style}>
              {part.slice(1, -1)}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function filterCss(layer: StudioImageLayer): string | undefined {
  const parts: string[] = [];
  if ((layer.brightness ?? 100) !== 100) parts.push(`brightness(${layer.brightness}%)`);
  if ((layer.contrast ?? 100) !== 100) parts.push(`contrast(${layer.contrast}%)`);
  if ((layer.saturate ?? 100) !== 100) parts.push(`saturate(${layer.saturate}%)`);
  if ((layer.blur ?? 0) > 0) parts.push(`blur(${layer.blur}px)`);
  if (layer.shadow) parts.push("drop-shadow(0 30px 40px rgba(0,0,0,0.35))");
  return parts.length ? parts.join(" ") : undefined;
}

function ImagePlaceholder({ layer, exporting }: { layer: StudioImageLayer; exporting: boolean }) {
  if (exporting) return null;
  const generating = layer.status === "generating";
  const failed = layer.status === "failed";
  const big = Math.max(28, Math.min(72, layer.width / 12));
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: layer.radius,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: big / 3,
        color: failed ? "#fca5a5" : "rgba(255,255,255,0.75)",
        background: failed
          ? "repeating-linear-gradient(45deg, rgba(239,68,68,0.10) 0 24px, rgba(239,68,68,0.04) 24px 48px)"
          : "linear-gradient(110deg, rgba(255,255,255,0.06) 8%, rgba(255,255,255,0.16) 18%, rgba(255,255,255,0.06) 33%)",
        backgroundSize: generating ? "200% 100%" : undefined,
        animation: generating ? "studio-shimmer 1.4s linear infinite" : undefined,
        border: "2px dashed rgba(255,255,255,0.18)",
        fontFamily: "var(--font-inter), sans-serif",
        fontSize: big / 2.2,
        fontWeight: 600,
        textAlign: "center",
        padding: 24,
      }}
    >
      {generating ? (
        <Loader2 style={{ width: big, height: big }} className="animate-spin" />
      ) : failed ? (
        <TriangleAlert style={{ width: big, height: big }} />
      ) : (
        <ImageIcon style={{ width: big, height: big }} />
      )}
      <span>{generating ? "Gerando imagem…" : failed ? "Imagem falhou — gere de novo" : "Sem imagem"}</span>
    </div>
  );
}

function ImageView({ layer, exporting }: { layer: StudioImageLayer; exporting: boolean }) {
  if (!layer.src) return <ImagePlaceholder layer={layer} exporting={exporting} />;
  const zoom = layer.fit === "cover" ? Math.max(1, layer.zoom || 1) : 1;
  const flip = layer.flipX ? " scaleX(-1)" : "";
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: layer.radius }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={layer.src}
        alt=""
        draggable={false}
        crossOrigin="anonymous"
        style={{
          width: "100%",
          height: "100%",
          objectFit: layer.fit,
          objectPosition: `${layer.focusX}% ${layer.focusY}%`,
          transform: `scale(${zoom})${flip}`,
          transformOrigin: `${layer.focusX}% ${layer.focusY}%`,
          filter: filterCss(layer),
          display: "block",
          userSelect: "none",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function textStyle(layer: StudioTextLayer): CSSProperties {
  return {
    fontFamily: layer.fontFamily,
    fontSize: layer.fontSize,
    fontWeight: layer.fontWeight,
    color: layer.color,
    textAlign: layer.align,
    lineHeight: layer.lineHeight,
    letterSpacing: `${layer.letterSpacing}px`,
    textTransform: layer.uppercase ? "uppercase" : "none",
    fontStyle: layer.italic ? "italic" : "normal",
    textShadow: layer.shadow ? "0 4px 24px rgba(0,0,0,0.45)" : undefined,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    wordBreak: "normal",
  };
}

export const studioTextStyle = textStyle;

function TextView({ layer }: { layer: StudioTextLayer }) {
  return (
    <div style={textStyle(layer)}>
      <AccentText layer={layer} />
    </div>
  );
}

function ShapeView({ layer }: { layer: StudioShapeLayer }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: gradientCss(layer.gradient) ?? layer.fill,
        borderRadius: layer.shape === "ellipse" ? "50%" : layer.radius,
        border: layer.stroke && layer.strokeWidth > 0 ? `${layer.strokeWidth}px solid ${layer.stroke}` : undefined,
      }}
    />
  );
}

function ButtonView({ layer }: { layer: StudioButtonLayer }) {
  const Icon = layer.icon ? CTA_ICONS.find((i) => i.id === layer.icon)?.Icon : null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: layer.fontSize * 0.45,
        padding: `0 ${Math.round(layer.height * 0.42)}px`,
        background: layer.fill,
        color: layer.color,
        borderRadius: Math.min(layer.radius, layer.height / 2),
        border: layer.stroke && layer.strokeWidth > 0 ? `${layer.strokeWidth}px solid ${layer.stroke}` : undefined,
        fontFamily: layer.fontFamily,
        fontSize: layer.fontSize,
        fontWeight: layer.fontWeight,
        textTransform: layer.uppercase ? "uppercase" : "none",
        whiteSpace: "nowrap",
        lineHeight: 1,
      }}
    >
      <span>{layer.text}</span>
      {Icon ? <Icon style={{ width: layer.fontSize * 1.05, height: layer.fontSize * 1.05 }} strokeWidth={2.4} /> : null}
    </div>
  );
}

export type FrameRendererProps = {
  page: StudioPage;
  width: number;
  height: number;
  /** Adiciona data-attrs e pointer-events para o canvas do editor. */
  interactive?: boolean;
  /** Esconde a camada (ex.: texto sendo editado no lugar). */
  hiddenLayerId?: string | null;
  /** Sem placeholders de imagem (exportação). */
  exporting?: boolean;
  children?: ReactNode;
};

function LayerView({
  layer,
  interactive,
  exporting,
  hidden,
}: {
  layer: StudioLayer;
  interactive: boolean;
  exporting: boolean;
  hidden: boolean;
}) {
  const autoHeight = layer.type === "text" && layer.autoHeight;
  const style: CSSProperties = {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: autoHeight ? undefined : layer.height,
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
    transformOrigin: "center center",
    opacity: layer.opacity,
    visibility: hidden ? "hidden" : undefined,
    pointerEvents: interactive && !layer.locked ? "auto" : "none",
  };
  return (
    <div
      style={style}
      data-layer-id={interactive ? layer.id : undefined}
      data-layer-type={interactive ? layer.type : undefined}
    >
      {layer.type === "image" ? (
        <ImageView layer={layer} exporting={exporting} />
      ) : layer.type === "text" ? (
        <TextView layer={layer} />
      ) : layer.type === "shape" ? (
        <ShapeView layer={layer} />
      ) : (
        <ButtonView layer={layer} />
      )}
    </div>
  );
}

export const FrameRenderer = memo(function FrameRenderer({
  page,
  width,
  height,
  interactive = false,
  hiddenLayerId,
  exporting = false,
  children,
}: FrameRendererProps) {
  return (
    <div
      data-page-frame={interactive ? page.id : undefined}
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        backgroundColor: page.background,
        backgroundImage: gradientCss(page.gradient),
        isolation: "isolate",
      }}
    >
      {page.layers.map((layer) =>
        layer.hidden ? null : (
          <LayerView
            key={layer.id}
            layer={layer}
            interactive={interactive}
            exporting={exporting}
            hidden={layer.id === hiddenLayerId}
          />
        )
      )}
      {children}
    </div>
  );
});

/** Miniatura escalada de uma página (lista de páginas, cards, demanda). */
export function FrameThumbnail({
  page,
  width,
  height,
  displayWidth,
  className,
}: {
  page: StudioPage;
  width: number;
  height: number;
  displayWidth: number;
  className?: string;
}) {
  const scale = displayWidth / width;
  return (
    <div className={className} style={{ width: displayWidth, height: height * scale, overflow: "hidden", position: "relative" }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width, height, pointerEvents: "none" }}>
        <FrameRenderer page={page} width={width} height={height} />
      </div>
    </div>
  );
}
