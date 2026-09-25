/**
 * Logo da marca nas artes geradas — regras fixas de produto:
 *
 * 1. NUNCA com fundo: logos enviadas como JPG/PNG chapado (ex.: dourado sobre
 *    azul) têm o fundo removido pela cor da borda, com bordas suaves e
 *    "descontaminação" da cor para não sobrar halo.
 * 2. SEMPRE com contraste: mede a luminância da área onde a logo vai pousar;
 *    se o contraste WCAG ficar abaixo de 3:1, a logo vira monocromática
 *    (clara em fundo escuro, cor mais escura da paleta em fundo claro).
 * 3. Posição fixa: topo centralizado, dentro da área segura de anúncios Meta.
 *    O prompt da arte reserva essa zona (ver LOGO_ZONE em technical-block).
 */

import sharp from "sharp";

/** Zona reservada da logo, em fração do canvas. Espelhada no prompt. */
export const LOGO_ZONE = {
  /** Topo da logo (5,5% da altura — fora do corte 4:5 do feed, que é ~3%). */
  top: 0.055,
  /** Caixa máxima da logo. */
  maxWidth: 0.3,
  maxHeight: 0.075,
} as const;

/** Contraste mínimo aceitável entre logo e fundo (WCAG para elementos gráficos). */
export const MIN_LOGO_CONTRAST = 3;

/**
 * Desvio-padrão máximo de luminância do fundo sob a logo. Acima disso a logo
 * está atravessando uma borda (faixa clara × foto escura, canto de foto,
 * objeto) e fica parcialmente ilegível — a arte deve ser refeita.
 */
export const MAX_LOGO_BACKGROUND_NOISE = 0.08;

// ---------------------------------------------------------------------------
// Cor
// ---------------------------------------------------------------------------

export function relativeLuminance(r: number, g: number, b: number): number {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(l1: number, l2: number): number {
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** Desvio-padrão da luminância relativa de uma imagem (0 = liso). */
async function luminanceStdDev(buf: Buffer): Promise<number> {
  const { data } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 3) {
    const l = relativeLuminance(data[i], data[i + 1], data[i + 2]);
    sum += l;
    sumSq += l * l;
    n++;
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sumSq / n - mean * mean));
}

async function meanLuminance(buf: Buffer, weightByAlpha: boolean): Promise<number> {
  const { data } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const w = weightByAlpha ? data[i + 3] / 255 : 1;
    sum += relativeLuminance(data[i], data[i + 1], data[i + 2]) * w;
    weight += w;
  }
  return weight > 0 ? sum / weight : 0;
}

// ---------------------------------------------------------------------------
// Remoção de fundo
// ---------------------------------------------------------------------------

/** Distância de cor abaixo da qual o pixel é fundo; acima de +RAMP é logo. */
const BG_THRESHOLD = 18;
const BG_RAMP = 70;

/**
 * Devolve a logo em PNG com fundo transparente e recortada rente ao desenho.
 * Logos que já têm transparência significativa só são recortadas.
 */
export async function prepareLogo(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) transparent++;
  if (transparent / (w * h) > 0.05) {
    return sharp(input).ensureAlpha().trim().png().toBuffer();
  }

  // Cor de fundo = mediana dos pixels da borda (resiste a ruído e gradiente leve).
  const offsets: number[] = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 200));
  for (let x = 0; x < w; x += step) offsets.push(x * 4, ((h - 1) * w + x) * 4);
  for (let y = 0; y < h; y += step) offsets.push(y * w * 4, (y * w + w - 1) * 4);
  const median = (k: number) => {
    const values = offsets.map((o) => data[o + k]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  const bg = [median(0), median(1), median(2)];

  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const dist = Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
    const alpha = Math.min(1, Math.max(0, (dist - BG_THRESHOLD) / BG_RAMP));
    out[i + 3] = Math.round(alpha * 255);
    for (let k = 0; k < 3; k++) {
      // Remove a mistura com o fundo nas bordas semitransparentes (sem halo).
      const c = alpha > 0.01 ? (data[i + k] - (1 - alpha) * bg[k]) / alpha : data[i + k];
      out[i + k] = Math.max(0, Math.min(255, Math.round(c)));
    }
  }

  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).trim().png().toBuffer();
}

async function recolor(logo: Buffer, [r, g, b]: [number, number, number]): Promise<Buffer> {
  const { data, info } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Composição
// ---------------------------------------------------------------------------

export type BrandLogoResult = {
  buffer: Buffer;
  /** "original" ou a cor usada na versão monocromática. */
  variant: string;
  contrast: number;
  /** Desvio de luminância do fundo sob a logo (com folga de 15% em volta). */
  backgroundNoise: number;
  /** false quando o fundo sob a logo não é uma área lisa (ver MAX_LOGO_BACKGROUND_NOISE). */
  backgroundOk: boolean;
};

/**
 * Compõe a logo (já sem fundo — ver prepareLogo) no topo central da arte,
 * garantindo contraste mínimo com o fundo onde ela pousa.
 */
export async function compositeBrandLogo(params: {
  art: Buffer;
  logo: Buffer;
  palette?: string[];
}): Promise<BrandLogoResult> {
  const meta = await sharp(params.art).metadata();
  const W = meta.width ?? 1024;
  const H = meta.height ?? 1365;

  let logo: Buffer = await sharp(params.logo)
    .resize({
      width: Math.round(W * LOGO_ZONE.maxWidth),
      height: Math.round(H * LOGO_ZONE.maxHeight),
      fit: "inside",
    })
    .png()
    .toBuffer();
  const lm = await sharp(logo).metadata();
  const lw = lm.width ?? 1;
  const lh = lm.height ?? 1;
  const left = Math.max(0, Math.round((W - lw) / 2));
  const top = Math.round(H * LOGO_ZONE.top);

  const region = await sharp(params.art)
    .extract({ left, top, width: Math.min(lw, W - left), height: Math.min(lh, H - top) })
    .png()
    .toBuffer();
  const bgLum = await meanLuminance(region, false);

  // Uniformidade medida numa caixa um pouco maior que a logo: pega bordas que
  // passam logo acima/abaixo dela também.
  const padX = Math.round(lw * 0.15);
  const padY = Math.round(lh * 0.35);
  const zoneLeft = Math.max(0, left - padX);
  const zoneTop = Math.max(0, top - padY);
  const zone = await sharp(params.art)
    .extract({
      left: zoneLeft,
      top: zoneTop,
      width: Math.min(lw + padX * 2, W - zoneLeft),
      height: Math.min(lh + padY * 2, H - zoneTop),
    })
    .png()
    .toBuffer();
  const backgroundNoise = await luminanceStdDev(zone);
  let contrast = contrastRatio(bgLum, await meanLuminance(logo, true));
  let variant = "original";

  if (contrast < MIN_LOGO_CONTRAST) {
    const lightBackground = bgLum > 0.3;
    const darkest = (params.palette ?? [])
      .map((hex) => ({ hex, rgb: hexToRgb(hex) }))
      .filter((c): c is { hex: string; rgb: [number, number, number] } => c.rgb !== null)
      .map((c) => ({ ...c, lum: relativeLuminance(...c.rgb) }))
      .sort((a, b) => a.lum - b.lum)[0];

    const target =
      lightBackground && darkest && contrastRatio(bgLum, darkest.lum) >= MIN_LOGO_CONTRAST
        ? darkest
        : lightBackground
          ? { hex: "#111111", rgb: [17, 17, 17] as [number, number, number] }
          : { hex: "#FFFFFF", rgb: [255, 255, 255] as [number, number, number] };

    logo = await recolor(logo, target.rgb);
    variant = target.hex;
    contrast = contrastRatio(bgLum, relativeLuminance(...target.rgb));
  }

  const buffer = await sharp(params.art)
    .composite([{ input: logo, left, top }])
    .png()
    .toBuffer();

  return {
    buffer,
    variant,
    contrast: Math.round(contrast * 100) / 100,
    backgroundNoise: Math.round(backgroundNoise * 1000) / 1000,
    backgroundOk: backgroundNoise <= MAX_LOGO_BACKGROUND_NOISE,
  };
}
