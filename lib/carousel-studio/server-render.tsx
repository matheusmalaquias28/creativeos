/**
 * Página do Carrossel Studio → PNG no servidor (Satori via next/og).
 *
 * Espelha o `FrameRenderer` do editor (components/carousel-studio/frame-renderer.tsx)
 * para o Agente de Carrossel montar cards sem navegador: texto de verdade
 * (com *destaques*), formas, botões com ícone e imagens já tratadas em sharp
 * (server-image.ts). Fontes em server-fonts.ts.
 *
 * Diferenças conhecidas do editor: a quebra de linha usa as métricas reais da
 * fonte no Satori (pode quebrar uma palavra antes/depois do navegador em casos
 * limite) e o espaço entre palavras é aproximado (0,26 em).
 */

import type { CSSProperties, ReactElement } from "react";
import { ImageResponse } from "next/og";
import { CTA_ICONS } from "@/lib/carousel/cta-icons";
import { withAlpha } from "./color";
import { prepareImageLayer, type PreparedImage } from "./server-image";
import { loadServerFonts, nearestWeight, serverFontId, type FontRequest } from "./server-fonts";
import { splitStudioText } from "./server-text";
import type {
  StudioButtonLayer,
  StudioGradient,
  StudioLayer,
  StudioPage,
  StudioShapeLayer,
  StudioTextLayer,
} from "@/types/carousel-studio";

function gradientCss(gradient: StudioGradient | null | undefined): string | undefined {
  if (!gradient || gradient.stops.length === 0) return undefined;
  const stops = [...gradient.stops]
    .sort((a, b) => a.at - b.at)
    .map((s) => `${withAlpha(s.color, s.opacity)} ${s.at}%`)
    .join(", ");
  return `linear-gradient(${gradient.angle}deg, ${stops})`;
}

const JUSTIFY = { left: "flex-start", center: "center", right: "flex-end" } as const;

/** O Satori quebra com propriedade de estilo `undefined`: tira as vazias. */
function css(style: CSSProperties): CSSProperties {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(style)) if (v !== undefined && v !== null) out[k] = v;
  return out as CSSProperties;
}

function TextView({ layer }: { layer: StudioTextLayer }) {
  const fontId = serverFontId(layer.fontFamily);
  const accentId = layer.accentFontFamily ? serverFontId(layer.accentFontFamily) : fontId;
  const lineHeight = Math.round(layer.fontSize * layer.lineHeight);
  const space = Math.round(layer.fontSize * 0.26 + layer.letterSpacing);
  const paragraphs = splitStudioText(layer.text, layer.uppercase);
  // Como no CSS: a letra fica centralizada na linha (meia entrelinha em cima e
  // embaixo), inclusive com lineHeight < 1, em que ela vaza da linha. O Satori
  // encosta a letra no topo da linha; por isso cada palavra é uma caixa da altura
  // da linha com o texto (altura natural, 1.2em) centralizado nela.
  const naturalLine = Math.round(layer.fontSize * 1.2);
  const base: CSSProperties = {
    fontFamily: fontId,
    fontSize: layer.fontSize,
    fontWeight: nearestWeight(fontId, layer.fontWeight),
    fontStyle: layer.italic ? "italic" : "normal",
    color: layer.color,
    letterSpacing: layer.letterSpacing,
    lineHeight: `${naturalLine}px`,
    // A palavra nunca quebra no meio (quebrava no hífen e sobrepunha a linha de baixo).
    whiteSpace: "nowrap",
    textShadow: layer.shadow ? "0 4px 24px rgba(0,0,0,0.45)" : undefined,
  };
  return (
    <div style={css({ display: "flex", flexDirection: "column", width: "100%" })}>
      {paragraphs.map((words, p) =>
        words.length === 0 ? (
          <div key={p} style={css({ display: "flex", height: lineHeight })} />
        ) : (
          <div
            key={p}
            style={css({ display: "flex", flexWrap: "wrap", width: "100%", justifyContent: JUSTIFY[layer.align], columnGap: space })}
          >
            {words.map((word, w) => (
              <div key={w} style={css({ display: "flex", flexShrink: 0, height: lineHeight, alignItems: "center" })}>
                {word.map((part, i) => {
                  const style: CSSProperties = { ...base };
                  if (part.accent) {
                    style.color = layer.accentColor;
                    style.fontFamily = accentId;
                    style.fontWeight = nearestWeight(accentId, layer.fontWeight);
                    if (layer.accentItalic) style.fontStyle = "italic";
                    if (layer.highlight) {
                      style.backgroundColor = layer.highlight;
                      style.padding = `0 ${Math.round(layer.fontSize * 0.12)}px`;
                      style.borderRadius = Math.round(layer.fontSize * 0.08);
                    }
                  }
                  return (
                    <span key={i} style={css(style)}>
                      {part.text}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function ShapeView({ layer }: { layer: StudioShapeLayer }) {
  return (
    <div
      style={css({
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: layer.gradient ? undefined : layer.fill,
        backgroundImage: gradientCss(layer.gradient),
        borderRadius: layer.shape === "ellipse" ? "50%" : layer.radius,
        border: layer.stroke && layer.strokeWidth > 0 ? `${layer.strokeWidth}px solid ${layer.stroke}` : undefined,
      })}
    />
  );
}

/** SVG do ícone do lucide a partir dos dados do ícone (sem renderizar componente). */
function ctaIcon(id: string | null, size: number, color: string): ReactElement | null {
  const def = id ? CTA_ICONS.find((i) => i.id === id) : null;
  if (!def) return null;
  const icon = def.Icon as unknown as { render: (props: object, ref: null) => { props: { iconNode?: [string, Record<string, string>][] } } };
  const nodes = icon.render({ size }, null)?.props?.iconNode ?? [];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {nodes.map(([tag, attrs], i) => {
        const { key: _key, ...rest } = attrs;
        void _key;
        const Tag = tag as unknown as "path";
        return <Tag key={i} {...(rest as object)} />;
      })}
    </svg>
  );
}

function ButtonView({ layer }: { layer: StudioButtonLayer }) {
  const fontId = serverFontId(layer.fontFamily);
  return (
    <div
      style={css({
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        gap: Math.round(layer.fontSize * 0.45),
        padding: `0 ${Math.round(layer.height * 0.42)}px`,
        backgroundColor: layer.fill,
        color: layer.color,
        borderRadius: Math.min(layer.radius, layer.height / 2),
        border: layer.stroke && layer.strokeWidth > 0 ? `${layer.strokeWidth}px solid ${layer.stroke}` : undefined,
        fontFamily: fontId,
        fontSize: layer.fontSize,
        fontWeight: nearestWeight(fontId, layer.fontWeight),
        lineHeight: 1,
        whiteSpace: "nowrap",
      })}
    >
      <span>{layer.uppercase ? layer.text.toLocaleUpperCase("pt-BR") : layer.text}</span>
      {ctaIcon(layer.icon, Math.round(layer.fontSize * 1.05), layer.color)}
    </div>
  );
}

function LayerView({ layer, image }: { layer: StudioLayer; image?: PreparedImage | null }) {
  const autoHeight = layer.type === "text" && layer.autoHeight;
  const style: CSSProperties = {
    position: "absolute",
    display: "flex",
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: autoHeight ? undefined : layer.height,
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
    transformOrigin: "center center",
    opacity: layer.opacity,
  };
  if (layer.type === "image") {
    if (!image) return null;
    return (
      <div style={css(style)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          width={image.width}
          height={image.height}
          style={css({ position: "absolute", left: image.left, top: image.top, width: image.width, height: image.height })}
          alt=""
        />
      </div>
    );
  }
  return (
    <div style={css(style)}>
      {layer.type === "text" ? (
        <TextView layer={layer} />
      ) : layer.type === "shape" ? (
        <ShapeView layer={layer} />
      ) : (
        <ButtonView layer={layer} />
      )}
    </div>
  );
}

function fontRequests(page: StudioPage): FontRequest[] {
  const out: FontRequest[] = [];
  for (const layer of page.layers) {
    if (layer.hidden) continue;
    if (layer.type === "text") {
      out.push({ id: serverFontId(layer.fontFamily), weight: layer.fontWeight, italic: layer.italic });
      if (layer.text.includes("*")) {
        out.push({
          id: serverFontId(layer.accentFontFamily ?? layer.fontFamily),
          weight: layer.fontWeight,
          italic: layer.italic || !!layer.accentItalic,
        });
      }
    } else if (layer.type === "button") {
      out.push({ id: serverFontId(layer.fontFamily), weight: layer.fontWeight, italic: false });
    }
  }
  return out;
}

/** Desenha a página e devolve PNG no tamanho do documento (ex.: 1080×1350). */
export async function renderStudioPage(page: StudioPage, size: { width: number; height: number }): Promise<Buffer> {
  const visible = page.layers.filter((l) => !l.hidden);
  const [fonts, images] = await Promise.all([
    loadServerFonts(fontRequests(page)),
    Promise.all(
      visible.map((l) =>
        l.type === "image"
          ? prepareImageLayer(l).catch((e) => {
              console.warn("[carousel-studio/server-render] imagem ignorada", l.id, e instanceof Error ? e.message : e);
              return null;
            })
          : null
      )
    ),
  ]);

  const response = new ImageResponse(
    (
      <div
        style={css({
          display: "flex",
          position: "relative",
          width: size.width,
          height: size.height,
          overflow: "hidden",
          backgroundColor: page.background,
          backgroundImage: gradientCss(page.gradient),
          fontFamily: "inter",
        })}
      >
        {visible.map((layer, i) => (
          <LayerView key={layer.id} layer={layer} image={images[i]} />
        ))}
      </div>
    ),
    { width: size.width, height: size.height, fonts: fonts.length ? fonts : undefined, emoji: "twemoji" }
  );
  return Buffer.from(await response.arrayBuffer());
}
