/**
 * Fontes que a IA pode escolher para o carrossel.
 *
 * Espelha os ids/famílias de `lib/design/fonts.ts` (as variáveis CSS são
 * definidas no <html> pelo next/font). Fica separado porque aquele arquivo
 * chama `next/font` e não pode ser importado no worker nem nos testes.
 */

export type StudioFontDef = {
  id: string;
  label: string;
  family: string;
  /** Peso mais forte disponível (títulos). */
  heavy: number;
  /** Peso de texto corrido. */
  regular: number;
  vibe: string;
};

export const STUDIO_FONTS: StudioFontDef[] = [
  { id: "manrope", label: "Manrope", family: "var(--font-manrope), sans-serif", heavy: 800, regular: 500, vibe: "sans moderna, limpa, tech" },
  { id: "inter", label: "Inter", family: "var(--font-inter), sans-serif", heavy: 800, regular: 400, vibe: "sans neutra, corporativa" },
  { id: "poppins", label: "Poppins", family: "var(--font-poppins), sans-serif", heavy: 800, regular: 400, vibe: "sans geométrica, amigável" },
  { id: "montserrat", label: "Montserrat", family: "var(--font-montserrat), sans-serif", heavy: 800, regular: 500, vibe: "sans geométrica, forte, marketing" },
  { id: "roboto", label: "Roboto", family: "var(--font-roboto), sans-serif", heavy: 900, regular: 400, vibe: "sans neutra" },
  { id: "space-grotesk", label: "Space Grotesk", family: "var(--font-space-grotesk), sans-serif", heavy: 700, regular: 400, vibe: "grotesca, tech, startup" },
  { id: "archivo", label: "Archivo", family: "var(--font-archivo), sans-serif", heavy: 800, regular: 400, vibe: "grotesca editorial, impacto" },
  { id: "oswald", label: "Oswald", family: "var(--font-oswald), sans-serif", heavy: 700, regular: 400, vibe: "condensada, impacto, esportiva" },
  { id: "bebas-neue", label: "Bebas Neue", family: "var(--font-bebas-neue), sans-serif", heavy: 400, regular: 400, vibe: "display condensada caixa alta, impacto máximo (só títulos)" },
  { id: "playfair", label: "Playfair Display", family: "var(--font-playfair), serif", heavy: 800, regular: 400, vibe: "serifada elegante, luxo, editorial" },
  { id: "merriweather", label: "Merriweather", family: "var(--font-merriweather), serif", heavy: 900, regular: 400, vibe: "serifada sóbria, jurídico, tradicional" },
  { id: "lora", label: "Lora", family: "var(--font-lora), serif", heavy: 700, regular: 400, vibe: "serifada suave, saúde, bem-estar" },
  { id: "recoleta", label: "Recoleta", family: "var(--font-recoleta), serif", heavy: 700, regular: 500, vibe: "serifada retrô, calorosa, gastronomia" },
];

export const STUDIO_FONT_IDS = STUDIO_FONTS.map((f) => f.id) as [string, ...string[]];

export function studioFontById(id: string | null | undefined): StudioFontDef {
  return STUDIO_FONTS.find((f) => f.id === id) ?? STUDIO_FONTS[0];
}

export function studioFontByFamily(family: string | null | undefined): StudioFontDef | null {
  if (!family) return null;
  return STUDIO_FONTS.find((f) => f.family === family) ?? null;
}

/** Peso válido para a família (Bebas só tem 400, etc.). */
export function heavyWeightFor(family: string): number {
  return studioFontByFamily(family)?.heavy ?? 800;
}
