/**
 * Partes puras do rodapé fixo da marca (testadas): cores e barra de progresso.
 * O desenho fica em brand-frame.tsx.
 */

/** Altura da faixa do rodapé, em px do card 1080×1350. */
export const FOOTER_BAND_HEIGHT = 150;
export const PROGRESS_WIDTH = 360;
export const PROGRESS_HEIGHT = 8;
export const PROGRESS_GAP = 10;

export type BrandFrameInput = {
  /** Posição do card (0 = capa) e total de cards. Total 1 = sem barra de progresso. */
  index: number;
  total: number;
  /** "@usuario" (sem @ também serve). */
  handle: string | null;
  /** Cor do trecho já lido da barra de progresso. */
  accent: string;
  /** Cores da marca, para achar a "tinta" escura sobre fundo claro. */
  palette: string[];
  /**
   * Só a barra de progresso, sem pintar a faixa nem desenhar @/ícones: o modelo
   * do Studio já traz o rodapé como camadas (editável no editor).
   */
  progressOnly?: boolean;
};

/** Distância do topo da faixa até a barra de progresso (mesma posição nos dois modos). */
export const PROGRESS_TOP = 33;

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Luminância relativa (WCAG), 0 = preto, 1 = branco. */
export function luminance({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Cor dos ícones e do texto: branco em fundo escuro; a cor escura da marca em fundo claro. */
export function inkFor(band: Rgb, palette: string[]): string {
  if (luminance(band) < 0.35) return "#ffffff";
  const dark = palette
    .map(hexToRgb)
    .filter((c): c is Rgb => !!c)
    .sort((a, b) => luminance(a) - luminance(b))[0];
  return dark && luminance(dark) < 0.12 ? toHex(dark) : "#15202b";
}

/** Largura do trecho lido da barra de progresso. */
export function progressFill(index: number, total: number, width = PROGRESS_WIDTH): number {
  if (total <= 1) return width;
  return Math.max(Math.round(width / total), Math.round((width * (index + 1)) / total));
}

/**
 * Cor da faixa do rodapé: a média exata quando a faixa já é lisa (a IA
 * respeitou a reserva, sem emenda visível); senão a cor dominante, que cobre o
 * que a IA tenha desenhado ali.
 */
export function bandColor(stats: {
  channels: { mean: number; stdev: number }[];
  dominant: Rgb;
}): Rgb {
  const [r, g, b] = stats.channels;
  const uniform = !!(r && g && b) && Math.max(r.stdev, g.stdev, b.stdev) < 18;
  return uniform ? { r: r.mean, g: g.mean, b: b.mean } : stats.dominant;
}
