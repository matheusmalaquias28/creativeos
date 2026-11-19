/**
 * Partes puras da logo aplicada em código (testadas): posição e escolha da
 * versão pela cor do fundo. O trabalho com imagem fica em logo.ts.
 */

import type { LogoPosition } from "@/types/carousel-profile";

export type { LogoPosition };
export type LogoMode = "auto" | "light" | "dark";

/** Caixa máxima da logo e margens, em px do card 1080×1350. */
export const LOGO_MAX_WIDTH = 300;
export const LOGO_MAX_HEIGHT = 100;
export const LOGO_TOP = 56;
export const LOGO_SIDE = 64;
/** Faixa do topo que a IA deixa sem texto (a logo entra ali depois). */
export const TOP_RESERVED_PX = 190;

export function logoPlacement(
  position: LogoPosition,
  size: { width: number; height: number },
  canvasWidth: number
): { left: number; top: number } {
  // Centraliza na vertical dentro da altura máxima: logos baixas e altas
  // ficam com o mesmo centro em todos os cards.
  const top = LOGO_TOP + Math.round((LOGO_MAX_HEIGHT - size.height) / 2);
  if (position === "top-left") return { left: LOGO_SIDE, top };
  if (position === "top-right") return { left: canvasWidth - LOGO_SIDE - size.width, top };
  return { left: Math.round((canvasWidth - size.width) / 2), top };
}

/** Razão de contraste WCAG entre duas luminâncias relativas (1 a 21). */
export function contrastRatio(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export type LogoCandidate<K extends string = string> = {
  key: K;
  /** Luminância média da parte visível da logo. */
  lum: number;
  /** Enviada pelo usuário (preferida) ou gerada em código (logo toda branca/escura). */
  uploaded: boolean;
};

/** Contraste mínimo para usar uma versão enviada sem cair na versão gerada. */
export const MIN_LOGO_CONTRAST = 3;

/**
 * Escolhe a versão da logo:
 * - auto: a enviada com mais contraste com o fundo; se nenhuma chega a 3:1,
 *   a de mais contraste entre todas (inclusive as geradas).
 * - light/dark: a enviada mais clara/escura; se ela não for clara/escura de
 *   verdade, a gerada.
 */
export function chooseLogo<K extends string>(
  candidates: LogoCandidate<K>[],
  bgLum: number,
  mode: LogoMode = "auto"
): LogoCandidate<K> {
  if (!candidates.length) throw new Error("Sem versões da logo");
  const byContrast = (list: LogoCandidate<K>[]) =>
    [...list].sort((a, b) => contrastRatio(b.lum, bgLum) - contrastRatio(a.lum, bgLum))[0];
  const uploaded = candidates.filter((c) => c.uploaded);

  if (mode === "light" || mode === "dark") {
    const light = mode === "light";
    const fits = (c: LogoCandidate<K>) => (light ? c.lum >= 0.5 : c.lum <= 0.2);
    const sorted = [...candidates].sort((a, b) => (light ? b.lum - a.lum : a.lum - b.lum));
    return sorted.find((c) => c.uploaded && fits(c)) ?? sorted.find(fits) ?? sorted[0];
  }

  const best = uploaded.length ? byContrast(uploaded) : null;
  if (best && contrastRatio(best.lum, bgLum) >= MIN_LOGO_CONTRAST) return best;
  return byContrast(candidates);
}
