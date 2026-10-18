import { describe, expect, it } from "vitest";
import { isStyleDna, styleDnaText, type StyleDna } from "../dna";
import { fallbackPlan } from "@/lib/carousel-studio/director";
import type { StudioBrandKit } from "@/types/carousel-studio";

const dna: StyleDna = {
  summary: "Editorial com muito respiro e números gigantes.",
  layoutGrammar: "Título alinhado à esquerda no terço superior, margem de 8%.",
  typography: { headingFont: "playfair", bodyFont: "inter", notes: "Títulos em caixa baixa, destaque em itálico." },
  color: {
    usage: "Fundo claro dominante, acento só nos números.",
    palette: { dark: "#111111", light: "#f5f1ea", primary: "#1d3557", accent: "#e63946" },
  },
  imageTreatment: "Fotos P&B recortadas em retângulo com cantos retos.",
  imageStylePrompt: "Fotografia preto e branco, alto contraste, grão fino.",
  recurringElements: [{ name: "número gigante", description: "algarismo em serifa, 40% da altura", placement: "canto superior direito do miolo" }],
  pages: { cover: "Título enorme e foto à direita.", inner: "Número + título + corpo curto.", cta: "Fundo escuro e botão contornado." },
  variationRules: "Alterna a foto entre esquerda e direita; tipografia e margens nunca mudam.",
  preferredLayouts: ["statement", "split", "cta"],
  avoid: ["degradês", "fotos coloridas"],
};

const brand: StudioBrandKit = {
  clientId: "c1",
  clientName: "Cliente",
  logoUrl: null,
  handle: "@cliente",
  palette: [],
  fontHeading: null,
  fontBody: null,
  styleNotes: "",
  businessContext: "",
  referenceUrls: [],
};

describe("DNA do estilo", () => {
  it("valida o formato salvo no banco", () => {
    expect(isStyleDna(dna)).toBe(true);
    expect(isStyleDna({})).toBe(false);
    expect(isStyleDna({ ...dna, typography: { ...dna.typography, headingFont: "comic-sans" } })).toBe(false);
  });

  it("vira texto com todas as partes para o diretor", () => {
    const text = styleDnaText(dna);
    expect(text).toContain("títulos em playfair");
    expect(text).toContain("número gigante");
    expect(text).toContain("Capa: Título enorme");
    expect(text).toContain("Evitar: degradês; fotos coloridas");
  });

  it("o plano sem IA usa as fontes e a direção de imagem do estilo", () => {
    const plan = fallbackPlan({
      title: "C",
      artes: [{ headline: "Um", subheadline: "", cta: "", informacoesExtras: "", linkReferencias: "", imagensReferencias: [] }],
      brand,
      format: "4:5",
      demandReferenceUrls: [],
      style: { name: "Creato", dna, imageUrls: [] },
    });
    expect(plan.fontHeading).toBe("playfair");
    expect(plan.fontBody).toBe("inter");
    expect(plan.imageStyle).toBe(dna.imageStylePrompt);
  });
});
