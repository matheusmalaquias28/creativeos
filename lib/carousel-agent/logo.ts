/**
 * Logo aplicada em código por cima da arte gerada (a IA só deixa o topo livre).
 *
 * Versões: a logo principal e a clara do perfil (enviadas) + duas geradas aqui
 * (a logo toda branca e toda na cor escura da marca). Em cada card, a versão é
 * escolhida pela cor do fundo embaixo da logo (`chooseLogo`); em fundo muito
 * carregado (foto) ganha uma sombra suave para continuar legível.
 */

import sharp, { type OverlayOptions } from "sharp";
import { inkFor, luminance, type Rgb } from "./brand-frame-layout";
import {
  chooseLogo,
  contrastRatio,
  logoPlacement,
  LOGO_MAX_HEIGHT,
  LOGO_MAX_WIDTH,
  MIN_LOGO_CONTRAST,
  type LogoCandidate,
  type LogoMode,
  type LogoPosition,
} from "./logo-layout";

type Key = "primary" | "light" | "white" | "dark";
type Variant = LogoCandidate<Key> & { png: Buffer; width: number; height: number };

export type LogoAsset = { variants: Variant[] };

export type LogoApplyInput = {
  asset: LogoAsset;
  position: LogoPosition;
  mode: LogoMode;
};

/** PNG com transparência de verdade; logo com fundo branco chapado perde o fundo. */
async function toTransparent(input: Buffer): Promise<Buffer> {
  const img = sharp(input).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const px = (x: number, y: number) => (y * width + x) * 4;

  let transparent = false;
  for (let i = 3; i < data.length; i += 4 * 7) {
    if (data[i] < 250) {
      transparent = true;
      break;
    }
  }
  if (!transparent) {
    const corners = [px(0, 0), px(width - 1, 0), px(0, height - 1), px(width - 1, height - 1)];
    const whiteBg = corners.every((i) => Math.min(data[i], data[i + 1], data[i + 2]) > 235);
    if (whiteBg) {
      // Rampa entre 215 e 245 para não deixar serrilhado na borda.
      for (let i = 0; i < data.length; i += 4) {
        const m = Math.min(data[i], data[i + 1], data[i + 2]);
        if (m > 215) data[i + 3] = Math.min(data[i + 3], Math.max(0, Math.round(((245 - m) / 30) * 255)));
      }
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/** Corta as bordas transparentes e cabe na caixa da logo. */
async function fit(png: Buffer): Promise<{ png: Buffer; width: number; height: number }> {
  const trimmed = await sharp(png).trim({ threshold: 1 }).png().toBuffer().catch(() => png);
  const out = await sharp(trimmed)
    .resize(LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { png: out.data, width: out.info.width, height: out.info.height };
}

/** Logo inteira numa cor só, mantendo o recorte. */
async function monochrome(png: Buffer, hex: string): Promise<Buffer> {
  const { width, height } = await sharp(png).metadata();
  const alpha = await sharp(png).ensureAlpha().extractChannel(3).toBuffer();
  return sharp({ create: { width: width!, height: height!, channels: 3, background: hex } })
    .joinChannel(alpha)
    .png()
    .toBuffer();
}

/** Luminância média da parte visível (pondera pelo alfa). */
async function visibleLuminance(png: Buffer): Promise<number> {
  const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, w = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    if (a < 0.1) continue;
    r += data[i] * a;
    g += data[i + 1] * a;
    b += data[i + 2] * a;
    w += a;
  }
  return w ? luminance({ r: r / w, g: g / w, b: b / w }) : 0;
}

async function variant(key: Key, png: Buffer, uploaded: boolean): Promise<Variant> {
  const fitted = await fit(png);
  return { key, uploaded, lum: await visibleLuminance(fitted.png), ...fitted };
}

/** Prepara as versões da logo (uma vez por geração). */
export async function prepareLogo(input: {
  /** Arquivos já baixados (logo principal e, se houver, a clara). */
  primary: Buffer;
  light?: Buffer | null;
  palette: string[];
}): Promise<LogoAsset> {
  const primary = await toTransparent(input.primary);
  const light = input.light ? await toTransparent(input.light).catch(() => null) : null;
  const darkInk = inkFor({ r: 255, g: 255, b: 255 }, input.palette);

  const variants = await Promise.all([
    variant("primary", primary, true),
    ...(light ? [variant("light", light, true)] : []),
    variant("white", await monochrome(primary, "#ffffff"), false),
    variant("dark", await monochrome(primary, darkInk), false),
  ]);
  return { variants };
}

/** Cola a logo no card (1080×1350). Devolve PNG. */
export async function applyLogo(card: Buffer, input: LogoApplyInput): Promise<Buffer> {
  const { width: W = 1080, height: H = 1350 } = await sharp(card).metadata();
  const ref = input.asset.variants[0];
  const at = logoPlacement(input.position, ref, W);
  const pad = 16;
  const region = {
    left: Math.max(0, at.left - pad),
    top: Math.max(0, at.top - pad),
    width: Math.min(W - Math.max(0, at.left - pad), ref.width + pad * 2),
    height: Math.min(H - Math.max(0, at.top - pad), ref.height + pad * 2),
  };
  const stats = await sharp(card).extract(region).stats();
  const [r, g, b] = stats.channels;
  const bg: Rgb = { r: r.mean, g: g.mean, b: b.mean };
  const bgLum = luminance(bg);
  const busy = Math.max(r.stdev, g.stdev, b.stdev) > 35;

  const chosen = chooseLogo(input.asset.variants, bgLum, input.mode) as Variant;
  const pos = logoPlacement(input.position, chosen, W);
  const layers: OverlayOptions[] = [];

  if (busy || contrastRatio(chosen.lum, bgLum) < MIN_LOGO_CONTRAST) {
    // Sombra suave (escura atrás de logo clara, clara atrás de logo escura).
    const blur = 10;
    const shadowColor = chosen.lum >= 0.4 ? "#000000" : "#ffffff";
    const m = blur * 2;
    const { data, info } = await sharp(await monochrome(chosen.png, shadowColor))
      .extend({ top: m, bottom: m, left: m, right: m, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .blur(blur)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * 0.55);
    const shadow = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toBuffer();
    layers.push({ input: shadow, left: pos.left - m, top: pos.top - m + 2 });
  }
  layers.push({ input: chosen.png, left: pos.left, top: pos.top });

  return sharp(card).composite(layers).png().toBuffer();
}
