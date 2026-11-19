/**
 * Fontes do Studio para o renderizador do servidor (Satori/next-og).
 *
 * O editor usa os woff2 locais via next/font (variáveis CSS), mas o Satori só
 * lê TTF/OTF/WOFF com pesos estáticos: aqui cada (fonte, peso, itálico) é
 * baixado do Google Fonts como TTF e guardado em memória. Recoleta não está no
 * Google Fonts: cai na Fraunces (serifada retrô parecida).
 */

import { studioFontByFamily, STUDIO_FONTS } from "./fonts";

/** id da fonte do Studio → nome no Google Fonts. */
const GOOGLE_NAME: Record<string, string> = {
  manrope: "Manrope",
  inter: "Inter",
  poppins: "Poppins",
  montserrat: "Montserrat",
  roboto: "Roboto",
  "space-grotesk": "Space Grotesk",
  archivo: "Archivo",
  oswald: "Oswald",
  "bebas-neue": "Bebas Neue",
  playfair: "Playfair Display",
  merriweather: "Merriweather",
  lora: "Lora",
  "instrument-serif": "Instrument Serif",
  caveat: "Caveat",
  recoleta: "Fraunces",
};

/** Pesos que cada família tem de verdade (o resto cai no mais próximo). */
const WEIGHTS: Record<string, number[]> = {
  "bebas-neue": [400],
  "instrument-serif": [400],
  caveat: [400, 500, 600, 700],
  "space-grotesk": [400, 500, 600, 700],
  oswald: [400, 500, 600, 700],
  lora: [400, 500, 600, 700],
  recoleta: [400, 500, 600, 700],
  roboto: [400, 500, 700, 900],
  merriweather: [400, 700, 900],
};
const DEFAULT_WEIGHTS = [400, 500, 600, 700, 800];

/** "var(--font-poppins), sans-serif" → "poppins" (fallback: inter). */
export function serverFontId(family: string | null | undefined): string {
  const known = studioFontByFamily(family);
  if (known) return known.id;
  const m = family?.match(/--font-([a-z0-9-]+)/i);
  if (m && STUDIO_FONTS.some((f) => f.id === m[1])) return m[1];
  return "inter";
}

export function nearestWeight(id: string, weight: number): number {
  const list = WEIGHTS[id] ?? DEFAULT_WEIGHTS;
  return list.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), list[0]);
}

export type FontRequest = { id: string; weight: number; italic: boolean };

export type SatoriFont = {
  name: string;
  data: ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
};

const cache = new Map<string, Promise<ArrayBuffer | null>>();

async function fetchGoogleTtf(name: string, weight: number, italic: boolean): Promise<ArrayBuffer | null> {
  const family = encodeURIComponent(name).replace(/%20/g, "+");
  const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${family}:${axis}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!css.ok) return null;
  const url = (await css.text()).match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!url) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  return res.ok ? res.arrayBuffer() : null;
}

function load(id: string, weight: number, italic: boolean): Promise<ArrayBuffer | null> {
  const key = `${id}:${weight}:${italic ? "i" : "n"}`;
  if (!cache.has(key)) {
    const name = GOOGLE_NAME[id] ?? "Inter";
    cache.set(
      key,
      (async () => {
        try {
          // Itálico que a família não tem cai no normal (o Satori não inventa itálico).
          return (await fetchGoogleTtf(name, weight, italic)) ?? (italic ? await fetchGoogleTtf(name, weight, false) : null);
        } catch {
          return null;
        }
      })().then((data) => {
        if (!data) cache.delete(key); // tenta de novo na próxima
        return data;
      })
    );
  }
  return cache.get(key)!;
}

/** Baixa as fontes pedidas (sem repetir) + Inter 400/700 como reserva. */
export async function loadServerFonts(requests: FontRequest[]): Promise<SatoriFont[]> {
  const unique = new Map<string, FontRequest>();
  for (const r of [...requests, { id: "inter", weight: 400, italic: false }, { id: "inter", weight: 700, italic: false }]) {
    const weight = nearestWeight(r.id, r.weight);
    unique.set(`${r.id}:${weight}:${r.italic}`, { id: r.id, weight, italic: r.italic });
  }
  const loaded = await Promise.all(
    [...unique.values()].map(async (r) => {
      const data = await load(r.id, r.weight, r.italic);
      return data
        ? ({ name: r.id, data, weight: r.weight as SatoriFont["weight"], style: r.italic ? "italic" : "normal" } as SatoriFont)
        : null;
    })
  );
  return loaded.filter((f): f is SatoriFont => !!f);
}
