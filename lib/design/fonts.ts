/**
 * Curated Google Fonts shared between the carousel editor and the design
 * profiles page. Each font is self-hosted by next/font and exposed as a CSS
 * variable so it can be referenced from inline styles (previews, rich text)
 * anywhere the variables are defined (they are attached to <html> in the root
 * layout).
 *
 * `family` is a ready-to-use `font-family` value — store it directly on a slide
 * or profile and drop it into a style object.
 */
import {
  Manrope,
  Inter,
  Poppins,
  Montserrat,
  Roboto,
  Space_Grotesk,
  Archivo,
  Oswald,
  Bebas_Neue,
  Playfair_Display,
  Merriweather,
  Lora,
} from "next/font/google";
import localFont from "next/font/local";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });
const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"], weight: ["400", "500", "700", "900"], display: "swap" });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const bebasNeue = Bebas_Neue({ variable: "--font-bebas-neue", subsets: ["latin"], weight: ["400"], display: "swap" });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });
const merriweather = Merriweather({ variable: "--font-merriweather", subsets: ["latin"], weight: ["400", "700", "900"], display: "swap" });
const lora = Lora({ variable: "--font-lora", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

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
  { id: "recoleta", label: "Recoleta", family: "var(--font-recoleta), serif", category: "serif" },
];

export const DEFAULT_FONT_FAMILY = FONT_OPTIONS[0].family;

/** Find the option whose family matches, for reflecting current state in pickers. */
export function findFontOption(family?: string | null): FontOption | undefined {
  if (!family) return undefined;
  return FONT_OPTIONS.find((f) => f.family === family);
}
