import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { isCarouselDemand } from "../demand";
import { estimateLineCount, fitFontSize } from "../text-fit";
import { buildStudioDocument, nearestAspect } from "../layouts";
import { fallbackPlan } from "../director";
import { removeFlatBackground } from "../cutout";
import { contrast, deriveRoles } from "../color";
import type { StudioBrandKit } from "@/types/carousel-studio";

const brand: StudioBrandKit = {
  clientId: "c1",
  clientName: "Graziela Bosso",
  logoUrl: "https://x.supabase.co/storage/v1/object/public/logos/logo.png",
  handle: "@grazielabosso_advogada",
  palette: ["#0f1b2d", "#c9a227", "#f4efe6"],
  fontHeading: null,
  fontBody: null,
  styleNotes: "",
  businessContext: "",
  referenceUrls: [],
};

const artes = [
  { headline: "Você não aguenta mais a empresa?", subheadline: "OBS: Não precisa adicionar texto aqui", cta: "Arraste para o lado", informacoesExtras: "", linkReferencias: "", imagensReferencias: [] },
  { headline: "O salário vive atrasando.", subheadline: "Todo mês é a mesma incerteza.", cta: "Arraste para o lado", informacoesExtras: "", linkReferencias: "", imagensReferencias: [] },
  { headline: "O FGTS não está sendo depositado.", subheadline: "Você abre o extrato e nada.", cta: "Arraste para o lado", informacoesExtras: "", linkReferencias: "", imagensReferencias: [] },
  { headline: "Antes de pedir demissão, entenda a sua situação.", subheadline: "Separe holerites e conversas.", cta: "Fale com uma advogada trabalhista", informacoesExtras: "", linkReferencias: "", imagensReferencias: [] },
];

describe("isCarouselDemand", () => {
  it("reconhece pelo briefing.tipo, tipoArte e título", () => {
    expect(isCarouselDemand({ tipo: "arte", briefing: { tipo: "Carrossel" } })).toBe(true);
    expect(isCarouselDemand({ tipo: "arte", briefing: { tipo: "Estática", titulo: "ONBOARDING - CARROSSEL" } })).toBe(true);
    expect(isCarouselDemand({ tipo: "arte", briefing: { tipo: "" }, raw_payload: { tipoArte: "Carrossel" } })).toBe(true);
    expect(isCarouselDemand({ tipo: "arte", briefing: { tipo: "Estática", titulo: "Post dia das mães" } })).toBe(false);
  });
});

describe("text-fit", () => {
  it("quebra mais linhas com fonte maior", () => {
    const base = { text: "Antes de pedir demissão, entenda a sua situação", width: 900, fontFamily: "var(--font-inter)" };
    expect(estimateLineCount({ ...base, fontSize: 120 })).toBeGreaterThan(estimateLineCount({ ...base, fontSize: 60 }));
  });

  it("fitFontSize respeita a altura máxima", () => {
    const size = fitFontSize({ text: "Um título bem longo que precisa caber em pouco espaço", width: 900, maxHeight: 250, fontFamily: "var(--font-inter)", lineHeight: 1.1, min: 40, max: 140 });
    expect(size).toBeLessThan(140);
    expect(size).toBeGreaterThanOrEqual(40);
  });
});

describe("layouts", () => {
  it("monta uma página por arte, com textos como camadas e imagens sem texto", () => {
    const plan = fallbackPlan({ title: "Carrossel", artes, brand, format: "4:5", demandReferenceUrls: [] });
    const { document, jobs } = buildStudioDocument({ plan, brand, format: "4:5" });

    expect(document.pages).toHaveLength(4);
    expect(document.width).toBe(1080);
    expect(document.height).toBe(1350);

    const titles = document.pages.map((p) => p.layers.find((l) => l.name === "Título"));
    expect(titles.every((t) => t && t.type === "text")).toBe(true);

    // A instrução "OBS: ..." não vira texto na arte.
    const firstTexts = document.pages[0].layers.filter((l) => l.type === "text").map((l) => (l.type === "text" ? l.text : ""));
    expect(firstTexts.some((t) => t.includes("OBS"))).toBe(false);

    // Último card tem botão com o CTA real.
    const button = document.pages[3].layers.find((l) => l.type === "button");
    expect(button && button.type === "button" && button.text).toBe("Fale com uma advogada trabalhista");

    // Logo do cliente entra como camada de imagem.
    expect(document.pages[0].layers.some((l) => l.type === "image" && l.role === "logo")).toBe(true);

    // Todo job de imagem aponta para uma camada existente e proíbe texto.
    for (const job of jobs) {
      const page = document.pages.find((p) => p.id === job.pageId)!;
      expect(page.layers.some((l) => l.id === job.layerId)).toBe(true);
      expect(job.prompt).toMatch(/NÃO pode conter nenhum texto/);
    }
  });

  it("camadas ficam dentro da página", () => {
    const plan = fallbackPlan({ title: "C", artes, brand, format: "1:1", demandReferenceUrls: [] });
    const { document } = buildStudioDocument({ plan, brand, format: "1:1" });
    for (const page of document.pages) {
      for (const layer of page.layers.filter((l) => l.type === "text")) {
        expect(layer.x).toBeGreaterThanOrEqual(0);
        expect(layer.x + layer.width).toBeLessThanOrEqual(document.width);
      }
    }
  });

  it("nearestAspect escolhe o formato suportado mais próximo", () => {
    expect(nearestAspect(1080, 1350)).toBe("4:5");
    expect(nearestAspect(904, 678)).toBe("4:3");
    expect(nearestAspect(500, 500)).toBe("1:1");
  });
});

describe("color", () => {
  it("deriveRoles produz escuro e claro contrastantes", () => {
    const roles = deriveRoles(brand.palette);
    expect(contrast(roles.dark, roles.light)).toBeGreaterThan(4.5);
  });
});

describe("removeFlatBackground", () => {
  it("remove o fundo branco ligado à borda e recorta no objeto", async () => {
    const size = 200;
    const circle = Buffer.from(
      `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#ffffff"/><circle cx="100" cy="100" r="50" fill="#c9a227"/><circle cx="100" cy="100" r="15" fill="#ffffff"/></svg>`
    );
    const png = await sharp(circle).png().toBuffer();
    const result = await removeFlatBackground(png, { padding: 0 });
    expect(result.removed).toBe(true);
    expect(result.width).toBeLessThanOrEqual(104);

    const { data, info } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
    // Canto do recorte: transparente. Centro (branco DENTRO do objeto): opaco.
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(Math.floor(info.width / 2), Math.floor(info.height / 2))).toBe(255);
  });

  it("não mexe em imagem com fundo complexo", async () => {
    const noisy = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#000" } })
      .composite([{ input: Buffer.from(`<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="64" fill="#ff0000"/><rect x="32" width="32" height="64" fill="#00ff00"/></svg>`) }])
      .png()
      .toBuffer();
    const result = await removeFlatBackground(noisy);
    expect(result.removed).toBe(false);
  });
});
