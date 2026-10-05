import { hexToRgb } from "@/lib/design/color";
import { normalizeHexColor } from "@/lib/utils/color";

/** Luminância relativa WCAG (0 = preto, 1 = branco). */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.32;
}

/** A cor (entre as candidatas) com maior contraste sobre o fundo. */
export function bestOn(background: string, candidates: string[]): string {
  return candidates.reduce((best, c) => (contrast(c, background) > contrast(best, background) ? c : best), candidates[0]);
}

export function cleanHex(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  return normalizeHexColor(value) ?? fallback;
}

/** "#rrggbb" + alpha 0–1 → rgba(). */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/**
 * Deriva as 4 cores-papel a partir da paleta da ficha quando a IA não está
 * disponível (ou devolveu algo inválido).
 */
export function deriveRoles(palette: string[]): {
  dark: string;
  light: string;
  primary: string;
  accent: string;
} {
  const colors = palette.map((c) => normalizeHexColor(c)).filter((c): c is string => Boolean(c));
  const sorted = [...colors].sort((a, b) => luminance(a) - luminance(b));
  const dark = sorted.find((c) => luminance(c) < 0.08) ?? "#0b0b0f";
  const light = [...sorted].reverse().find((c) => luminance(c) > 0.75) ?? "#f7f5f0";
  const chromatic = colors.filter((c) => c !== dark && c !== light);
  const primary = chromatic[0] ?? colors[0] ?? "#2f5bea";
  const accent =
    chromatic.find((c) => c !== primary && contrast(c, dark) >= 3) ??
    (contrast(primary, dark) >= 3 ? primary : "#f5c542");
  return { dark, light, primary, accent };
}
