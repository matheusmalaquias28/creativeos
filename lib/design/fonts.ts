/**
 * Curated fonts shared between the carousel editor and the design profiles
 * page. Each font is self-hosted and exposed as a CSS variable so it can be
 * referenced from inline styles (previews, rich text) anywhere the variables
 * are defined (they are attached to <html> in the root layout).
 *
 * `family` is a ready-to-use `font-family` value — store it directly on a slide
 * or profile and drop it into a style object.
 */
import localFont from "next/font/local";

// Todas as Google Fonts ficam no repositório (woff2 subset latin, licença OFL)
// via next/font/local. Buscá-las no Google Fonts durante o build quebrava o
// deploy na Vercel sempre que uma fonte saía do cache de build ("Cannot read
// properties of null (reading '1')": next/font recebia URL de arquivo sem
// extensão). Fontes variáveis são um arquivo só cobrindo a faixa de pesos.
const manrope = localFont({
  variable: "--font-manrope",
  display: "swap",
  src: [{ path: "./fonts/manrope/Manrope-Variable.woff2", weight: "400 800", style: "normal" }],
});
const inter = localFont({
  variable: "--font-inter",
  display: "swap",
  src: [{ path: "./fonts/inter/Inter-Variable.woff2", weight: "400 800", style: "normal" }],
});
const poppins = localFont({
  variable: "--font-poppins",
  display: "swap",
  src: [
    { path: "./fonts/poppins/Poppins-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins/Poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins/Poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins/Poppins-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/poppins/Poppins-800.woff2", weight: "800", style: "normal" },
  ],
});
const montserrat = localFont({
  variable: "--font-montserrat",
  display: "swap",
  src: [{ path: "./fonts/montserrat/Montserrat-Variable.woff2", weight: "400 800", style: "normal" }],
});
const roboto = localFont({
  variable: "--font-roboto",
  display: "swap",
  src: [{ path: "./fonts/roboto/Roboto-Variable.woff2", weight: "400 900", style: "normal" }],
});
const spaceGrotesk = localFont({
  variable: "--font-space-grotesk",
  display: "swap",
  src: [{ path: "./fonts/space-grotesk/SpaceGrotesk-Variable.woff2", weight: "400 700", style: "normal" }],
});
const archivo = localFont({
  variable: "--font-archivo",
  display: "swap",
  src: [{ path: "./fonts/archivo/Archivo-Variable.woff2", weight: "400 800", style: "normal" }],
});
const oswald = localFont({
  variable: "--font-oswald",
  display: "swap",
  src: [{ path: "./fonts/oswald/Oswald-Variable.woff2", weight: "400 700", style: "normal" }],
});
const bebasNeue = localFont({
  variable: "--font-bebas-neue",
  display: "swap",
  src: [{ path: "./fonts/bebas-neue/BebasNeue-400.woff2", weight: "400", style: "normal" }],
});
const playfair = localFont({
  variable: "--font-playfair",
  display: "swap",
  src: [{ path: "./fonts/playfair-display/PlayfairDisplay-Variable.woff2", weight: "400 800", style: "normal" }],
});
const merriweather = localFont({
  variable: "--font-merriweather",
  display: "swap",
  src: [{ path: "./fonts/merriweather/Merriweather-Variable.woff2", weight: "400 900", style: "normal" }],
});
const lora = localFont({
  variable: "--font-lora",
  display: "swap",
  src: [{ path: "./fonts/lora/Lora-Variable.woff2", weight: "400 700", style: "normal" }],
});
/** Fonte mono da UI (var `--font-mono` no globals.css). */
export const geistMono = localFont({
  variable: "--font-geist-mono",
  display: "swap",
  src: [{ path: "./fonts/geist-mono/GeistMono-Variable.woff2", weight: "100 900", style: "normal" }],
});
const instrumentSerif = localFont({
  variable: "--font-instrument-serif",
  display: "swap",
  src: [
    { path: "./fonts/instrument-serif/InstrumentSerif-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif/InstrumentSerif-Italic.woff2", weight: "400", style: "italic" },
  ],
});
const caveat = localFont({
  variable: "--font-caveat",
  display: "swap",
  src: [{ path: "./fonts/caveat/Caveat-Variable.woff2", weight: "400 700", style: "normal" }],
});

// Recoleta — fonte serif proprietária, self-hosted (não é Google Font).
const recoleta = localFont({
  variable: "--font-recoleta",
  display: "swap",
  src: [
    { path: "./fonts/recoleta/Recoleta-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/recoleta/Recoleta-Bold.woff2", weight: "700", style: "normal" },
  ],
});

/** Space-joined className with every font variable — attach to <html>. */
export const fontVariables = [
  manrope.variable,
  inter.variable,
  poppins.variable,
  montserrat.variable,
  roboto.variable,
  spaceGrotesk.variable,
  archivo.variable,
  oswald.variable,
  bebasNeue.variable,
  playfair.variable,
  merriweather.variable,
  lora.variable,
  instrumentSerif.variable,
  caveat.variable,
  recoleta.variable,
].join(" ");

export type FontCategory = "sans" | "serif" | "display";

export type FontOption = {
  id: string;
  label: string;
  /** Ready-to-use CSS font-family value. */
  family: string;
  category: FontCategory;
};

export const FONT_OPTIONS: FontOption[] = [
  { id: "manrope", label: "Manrope", family: "var(--font-manrope), sans-serif", category: "sans" },
  { id: "inter", label: "Inter", family: "var(--font-inter), sans-serif", category: "sans" },
  { id: "poppins", label: "Poppins", family: "var(--font-poppins), sans-serif", category: "sans" },
  { id: "montserrat", label: "Montserrat", family: "var(--font-montserrat), sans-serif", category: "sans" },
  { id: "roboto", label: "Roboto", family: "var(--font-roboto), sans-serif", category: "sans" },
  { id: "space-grotesk", label: "Space Grotesk", family: "var(--font-space-grotesk), sans-serif", category: "sans" },
  { id: "archivo", label: "Archivo", family: "var(--font-archivo), sans-serif", category: "sans" },
  { id: "oswald", label: "Oswald", family: "var(--font-oswald), sans-serif", category: "display" },
  { id: "bebas-neue", label: "Bebas Neue", family: "var(--font-bebas-neue), sans-serif", category: "display" },
  { id: "playfair", label: "Playfair Display", family: "var(--font-playfair), serif", category: "serif" },
  { id: "merriweather", label: "Merriweather", family: "var(--font-merriweather), serif", category: "serif" },
  { id: "lora", label: "Lora", family: "var(--font-lora), serif", category: "serif" },
  { id: "instrument-serif", label: "Instrument Serif", family: "var(--font-instrument-serif), serif", category: "serif" },
  { id: "caveat", label: "Caveat (manuscrita)", family: "var(--font-caveat), cursive", category: "display" },
  { id: "recoleta", label: "Recoleta", family: "var(--font-recoleta), serif", category: "serif" },
];

export const DEFAULT_FONT_FAMILY = FONT_OPTIONS[0].family;

/** Find the option whose family matches, for reflecting current state in pickers. */
export function findFontOption(family?: string | null): FontOption | undefined {
  if (!family) return undefined;
  return FONT_OPTIONS.find((f) => f.family === family);
}
