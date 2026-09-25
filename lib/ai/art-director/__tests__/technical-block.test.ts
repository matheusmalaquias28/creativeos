import { describe, expect, it } from "vitest";
import {
  appendTechnicalBlock,
  buildReferenceBlock,
  buildStandardsBlock,
  buildTextBlock,
  CONTENT_TOP,
  CTA_BOTTOM,
  LOGO_ZONE_BAND,
  sanitizeBrief,
} from "../technical-block";
import { ART_ASPECT_RATIO } from "../constants";

describe("buildReferenceBlock", () => {
  it("marca a primeira referência de estilo como layout mestre e enumera na ordem", () => {
    const out = buildReferenceBlock([
      { role: "layout", intent: "a divisão de quadro" },
      { role: "textura", intent: "o grão do papel" },
    ]);
    expect(out).toContain("- Image 1 is the LAYOUT & TYPOGRAPHY MASTER");
    expect(out).toContain("Focus: a divisão de quadro");
    expect(out).toContain("- Image 2 is a supporting reference (textura) — use it only for: o grão do papel.");
  });

  it("foto real do cliente vem antes e não vira mestre", () => {
    const out = buildReferenceBlock([
      { role: "personagem", intent: null },
      { role: "estilo", intent: null },
    ]);
    expect(out).toContain("- Image 1 is a real photo of the client");
    expect(out).toContain("- Image 2 is the LAYOUT & TYPOGRAPHY MASTER");
  });

  it("ignora a logo e retorna vazio sem referências", () => {
    expect(buildReferenceBlock([])).toBe("");
    expect(buildReferenceBlock([{ role: "logo", intent: null }])).toBe("");
  });
});

describe("buildTextBlock", () => {
  it("lista somente os textos permitidos, com o CTA marcado como botão", () => {
    const out = buildTextBlock({ headline: "Divórcio sem briga", cta: "Fale agora" });
    expect(out).toContain('"Divórcio sem briga"');
    expect(out).toContain('"Fale agora" (button)');
    expect(out).toContain("same letter case");
    expect(out).toContain("never any English words");
  });

  it("sem copy, proíbe texto mas mantém a composição", () => {
    expect(buildTextBlock({})).toContain("NO text at all");
  });
});

describe("buildStandardsBlock", () => {
  it("impõe área segura, zona da logo e botão centralizado na base", () => {
    const out = buildStandardsBlock({ headline: "oi", cta: "Saiba mais", aspectRatio: ART_ASPECT_RATIO });
    expect(out).toContain("3:4 portrait");
    expect(out).toContain("Meta");
    expect(out).toContain(`${Math.round(LOGO_ZONE_BAND.to * 100)}% of the height`);
    expect(out).toContain(`starts below ${Math.round(CONTENT_TOP * 100)}%`);
    expect(out).toContain("Do NOT draw any logo");
    expect(out).toContain("horizontally centred");
    expect(out).toContain(`${Math.round(CTA_BOTTOM * 100)}% of the canvas height`);
  });

  it("não fala de botão quando não há CTA", () => {
    expect(buildStandardsBlock({ headline: "oi" })).not.toContain("BUTTON:");
  });
});

describe("sanitizeBrief", () => {
  it("troca o tipo de documento em inglês, sem tocar a copy em português", () => {
    expect(sanitizeBrief("a folded paper contract beside Contracts")).toBe(
      "a folded paper printed pages beside printed pages"
    );
    expect(sanitizeBrief('headline "consulte o contrato."')).toBe('headline "consulte o contrato."');
  });

  it("é aplicado ao briefing no prompt final", () => {
    expect(appendTechnicalBlock("a signed contract", {}, [])).toContain("a signed printed pages");
  });
});

describe("appendTechnicalBlock", () => {
  const prompt = "Briefing do diretor.";

  it("ordena referências, briefing e padrões", () => {
    const out = appendTechnicalBlock(prompt, { headline: "oi" }, [{ role: "layout", intent: null }]);
    const iRefs = out.indexOf("REFERENCE IMAGES");
    const iBrief = out.indexOf(prompt);
    const iStd = out.indexOf("PRODUCTION STANDARDS");
    expect(iRefs).toBeGreaterThanOrEqual(0);
    expect(iRefs).toBeLessThan(iBrief);
    expect(iBrief).toBeLessThan(iStd);
  });

  it("anexa as correções da revisão quando houver", () => {
    const out = appendTechnicalBlock(prompt, { headline: "oi" }, [], ["Remova a palavra CONTRACT"]);
    expect(out).toContain("A PREVIOUS ATTEMPT FAILED REVIEW");
    expect(out).toContain("- Remova a palavra CONTRACT");
    expect(appendTechnicalBlock(prompt, { headline: "oi" }, [])).not.toContain("FAILED REVIEW");
  });

  it("é determinístico", () => {
    const spec = { headline: "oi", cta: "clique", aspectRatio: "3:4" };
    const refs = [{ role: "estilo" as const, intent: "x" }];
    expect(appendTechnicalBlock(prompt, spec, refs)).toBe(appendTechnicalBlock(prompt, spec, refs));
  });
});
