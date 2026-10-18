import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  assignModels,
  buildFromTemplates,
  buildTemplateCatalog,
  fallbackTemplatePlan,
} from "../template-fill";
import { makeButtonLayer, makeImageLayer, makePage, makeShapeLayer, makeTextLayer } from "../layers";
import { draftToPage, type CardDraft } from "@/lib/carousel-styles/template-draft";
import type { StudioBrandKit, StudioPage } from "@/types/carousel-studio";

const brand: StudioBrandKit = {
  clientId: "c1",
  clientName: "Herika Seabra",
  logoUrl: "https://x.supabase.co/logo.png",
  handle: "@herika",
  palette: [],
  fontHeading: null,
  fontBody: null,
  styleNotes: "",
  businessContext: "",
  referenceUrls: [],
};

function templates(): StudioPage[] {
  const cover = makePage({ name: "1. Capa", templateRole: "cover", background: "#e5dcd0" });
  cover.layers.push(
    makeImageLayer({ role: "background", width: 1080, height: 1350, slot: "image", prompt: "foto de pessoa no campo" }),
    makeTextLayer({ text: "How to create *Carousels*", slot: "title", width: 900, fontSize: 120 }),
    makeImageLayer({ src: "https://x/logo-exemplo.png", slot: "logo", width: 200, height: 80 })
  );
  const innerA = makePage({ name: "2. Miolo print", templateRole: "inner" });
  innerA.layers.push(
    makeShapeLayer({ name: "pílula" }),
    makeTextLayer({ text: "Upload Reference *Images*", slot: "title" }),
    makeTextLayer({ text: "Upload your design references to Claude Design.", slot: "body", fontSize: 30 }),
    makeTextLayer({ text: "UPLOAD REFERENCES", slot: "note", fontSize: 28 }),
    makeImageLayer({ src: "https://x/print.png", role: "photo", slot: "image", prompt: "print de interface", width: 500, height: 600 }),
    makeButtonLayer({ text: "SWIPE" })
  );
  const innerB = makePage({ name: "3. Miolo mockups", templateRole: "inner" });
  innerB.layers.push(makeTextLayer({ text: "Scale it Across *Platforms*", slot: "title" }));
  return [cover, innerA, innerB];
}

describe("páginas-modelo → carrossel", () => {
  it("o catálogo lista os campos de cada modelo, sem a logo", () => {
    const catalog = buildTemplateCatalog(templates());
    expect(catalog.map((c) => c.code)).toEqual(["M1", "M2", "M3"]);
    expect(catalog[1].fields.map((f) => f.key)).toEqual(["title", "body", "note", "image"]);
    expect(catalog[0].fields.some((f) => f.slot === "logo")).toBe(false);
  });

  it("distribui capa no primeiro card e alterna os miolos", () => {
    const catalog = buildTemplateCatalog(templates());
    expect(assignModels(catalog, 5)).toEqual(["M1", "M2", "M3", "M2", "M3"]);
  });

  it("clona o modelo trocando só os campos e mantém a decoração", () => {
    const catalog = buildTemplateCatalog(templates());
    const artes = [
      { headline: "Seus direitos *trabalhistas*", subheadline: "", cta: "", informacoesExtras: "", linkReferencias: "", imagensReferencias: [] },
      { headline: "Rescisão indireta", subheadline: "Quando o empregador descumpre o contrato.", cta: "", informacoesExtras: "", linkReferencias: "", imagensReferencias: [] },
    ];
    const plan = fallbackTemplatePlan({ artes, catalog, title: "C" });
    const { document, jobs } = buildFromTemplates({ plan, catalog, brand, format: "4:5", templateHeight: 1350, imageStyle: "papel bege" });

    expect(document.pages).toHaveLength(2);
    const [cover, inner] = document.pages;
    const coverTitle = cover.layers.find((l) => l.type === "text");
    expect(coverTitle && coverTitle.type === "text" && coverTitle.text).toBe("Seus direitos *trabalhistas*");
    const logo = cover.layers.find((l) => l.type === "image" && l.role !== "background");
    expect(logo && logo.type === "image" && logo.src).toBe(brand.logoUrl);

    // Decoração fixa intacta, campo vazio escondido, nenhuma camada com slot.
    expect(inner.layers.some((l) => l.type === "shape")).toBe(true);
    const swipe = inner.layers.find((l) => l.type === "button");
    expect(swipe && swipe.type === "button" && swipe.text).toBe("SWIPE");
    const note = inner.layers.filter((l) => l.type === "text")[2];
    expect(note.hidden).toBe(true);
    expect(document.pages.flatMap((p) => p.layers).every((l) => !l.slot)).toBe(true);

    // Uma imagem por campo "image", com a prévia do modelo como referência.
    expect(jobs).toHaveLength(2);
    expect(jobs[1].referenceUrls).toEqual(["https://x/print.png"]);
    expect(jobs[1].prompt).toContain("Rescisão indireta");
  });

  it("encolhe o título quando a copy é bem maior que o exemplo", () => {
    const catalog = buildTemplateCatalog(templates());
    const long = "Um título muito mais longo do que o exemplo do modelo, com várias palavras a mais";
    const plan = { slides: [{ model: "M1", texts: [{ key: "title", text: long }], images: [] }], caption: "" };
    const { document } = buildFromTemplates({ plan, catalog, brand, format: "4:5", templateHeight: 1350, imageStyle: "" });
    const title = document.pages[0].layers.find((l) => l.type === "text");
    expect(title && title.type === "text" && title.fontSize).toBeLessThan(120);
  });

  it("adapta a altura dos modelos 4:5 para stories", () => {
    const catalog = buildTemplateCatalog(templates());
    const plan = fallbackTemplatePlan({ artes: [], catalog, title: "C" });
    const { document } = buildFromTemplates({ plan, catalog, brand, format: "9:16", templateHeight: 1350, imageStyle: "" });
    expect(document.height).toBe(1920);
    const bg = document.pages[0].layers[0];
    expect(bg.height).toBe(1920);
  });
});

describe("rascunho do modelo (IA) → página", () => {
  it("converte milésimos em px e preserva fontes de destaque", async () => {
    const original = await sharp({ create: { width: 1080, height: 1440, channels: 3, background: "#e5dcd0" } }).png().toBuffer();
    const base = {
      rotation: 0, text: "", font: "inter", accentFont: "none", accentItalic: false, fontSize: 0, weight: 700,
      italic: false, uppercase: false, align: "left" as const, lineHeight: 1, letterSpacing: 0, color: "#2e1e19",
      accentColor: "#2e1e19", fill: "#000000", radius: 0, shape: "rect" as const, shadow: false, description: "", cutout: false,
    };
    const draft: CardDraft = {
      role: "inner",
      name: "Miolo",
      background: "#E5DCD0",
      layers: [
        { ...base, kind: "text", slot: "title", x: 80, y: 100, w: 840, h: 200, text: "Adjust and Approve *the Design System*", fontSize: 95, accentFont: "instrument-serif", accentItalic: true },
        { ...base, kind: "shape", slot: "none", x: 800, y: 900, w: 150, h: 50, fill: "#ffffff", radius: 999 },
      ],
    };
    const page = await draftToPage({ draft, original, templateId: "t1", width: 1080, height: 1350 });
    expect(page.background).toBe("#E5DCD0");
    expect(page.templateRole).toBe("inner");
    const [title, pill] = page.layers;
    expect(title.type === "text" && title.slot).toBe("title");
    expect(title.x).toBe(86);
    expect(title.y).toBe(135);
    expect(title.type === "text" && title.fontSize).toBe(103);
    expect(title.type === "text" && title.accentFontFamily).toContain("instrument-serif");
    expect(title.type === "text" && title.accentItalic).toBe(true);
    expect(pill.type === "shape" && pill.radius).toBe(999);
  });
});
