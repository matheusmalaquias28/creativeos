import { describe, it, expect } from "vitest";
import { compilePrompt, buildOrderedRefs, buildReferenceBlock } from "../prompt-compiler";
import type { CreativeProfile, BriefingCopy, ArtSpec, DemandReference } from "../prompt-compiler";

const baseProfile: CreativeProfile = {
  base_prompt: "Marca jovem e vibrante, design clean e moderno.",
  palette: ["#1A2B3C", "#FF8800"],
  logo_mode: "composite",
  style_reference_urls: [],
};

const baseBriefing: BriefingCopy = {
  titulo: "Promoção de Verão",
  tipo: "Post Instagram",
};

const baseSpec: ArtSpec = {
  headline: "50% OFF em todos os produtos",
  subheadline: "Só até domingo",
  cta: "Compre agora",
  aspect_ratio: "1:1",
  image_size: "2K",
};

describe("compilePrompt", () => {
  it("inclui o base_prompt do cliente", () => {
    const result = compilePrompt(baseProfile, baseBriefing, baseSpec);
    expect(result).toContain(baseProfile.base_prompt);
  });

  it("inclui o título da campanha", () => {
    const result = compilePrompt(baseProfile, baseBriefing, baseSpec);
    expect(result).toContain("Promoção de Verão");
  });

  it("inclui headline, subheadline e CTA", () => {
    const result = compilePrompt(baseProfile, baseBriefing, baseSpec);
    expect(result).toContain("50% OFF em todos os produtos");
    expect(result).toContain("Só até domingo");
    expect(result).toContain("Compre agora");
  });

  it("inclui a paleta de cores em hex", () => {
    const result = compilePrompt(baseProfile, baseBriefing, baseSpec);
    expect(result).toContain("#1A2B3C");
    expect(result).toContain("#FF8800");
  });

  it("não menciona logo quando logo_mode=composite", () => {
    const result = compilePrompt(baseProfile, baseBriefing, baseSpec);
    // No modo composite, o logo é sobreposto depois — não entra no prompt
    expect(result).not.toContain("este é o logo da marca");
  });

  it("menciona logo quando logo_mode=reference", () => {
    const profile: CreativeProfile = { ...baseProfile, logo_mode: "reference" };
    const result = compilePrompt(profile, baseBriefing, baseSpec);
    expect(result).toContain("este é o logo da marca");
  });

  it("restringe os textos da imagem e trata o CTA como botão centralizado embaixo", () => {
    const result = compilePrompt(baseProfile, baseBriefing, baseSpec);
    expect(result).toContain("A IMAGEM DEVE CONTER SOMENTE ESSES TEXTOS, NADA MAIS:");
    expect(result).toContain("BOTÃO");
    expect(result).toContain("centralizado na parte inferior da imagem");
  });

  it("sem CTA não inclui a regra do botão", () => {
    const spec: ArtSpec = { ...baseSpec, cta: null };
    const result = compilePrompt(baseProfile, baseBriefing, spec);
    expect(result).not.toContain("BOTÃO");
  });

  it("funciona sem paleta", () => {
    const profile: CreativeProfile = { ...baseProfile, palette: [] };
    const result = compilePrompt(profile, baseBriefing, baseSpec);
    expect(result).not.toContain("paleta de cores");
  });

  it("funciona sem briefing.titulo", () => {
    const briefing: BriefingCopy = { ...baseBriefing, titulo: null };
    const result = compilePrompt(baseProfile, briefing, baseSpec);
    expect(result).not.toContain("campanha:");
  });

  it("inclui aspect_ratio e image_size", () => {
    const result = compilePrompt(baseProfile, baseBriefing, baseSpec);
    expect(result).toContain("1:1");
    expect(result).toContain("2K");
  });

  it("funciona sem textos na arte (spec vazio)", () => {
    const spec: ArtSpec = {};
    const result = compilePrompt(baseProfile, baseBriefing, spec);
    expect(result).toContain(baseProfile.base_prompt);
    expect(result).not.toContain("Headline principal");
  });

  it("é determinístico — mesma entrada, mesma saída", () => {
    const r1 = compilePrompt(baseProfile, baseBriefing, baseSpec);
    const r2 = compilePrompt(baseProfile, baseBriefing, baseSpec);
    expect(r1).toBe(r2);
  });
});

describe("buildOrderedRefs", () => {
  const profileWithStyleRefs: CreativeProfile = {
    ...baseProfile,
    style_reference_urls: ["https://example.com/ref1.jpg", "https://example.com/ref2.jpg"],
  };

  const demandRefs: DemandReference[] = [
    { url: "https://example.com/demand1.jpg", role: "este é o produto em destaque" },
    { url: "https://example.com/demand2.jpg", role: null },
  ];

  it("sem referências retorna array vazio", () => {
    const refs = buildOrderedRefs(baseProfile, []);
    expect(refs).toHaveLength(0);
  });

  it("apenas referências do cliente (sem logo, sem demand)", () => {
    const refs = buildOrderedRefs(profileWithStyleRefs, []);
    expect(refs).toHaveLength(2);
    expect(refs[0].role).toContain("estilo visual");
    expect(refs[1].role).toContain("estilo visual");
  });

  it("ordem: cliente → logo (reference mode) → demand", () => {
    const profile: CreativeProfile = {
      ...profileWithStyleRefs,
      logo_mode: "reference",
    };
    const refs = buildOrderedRefs(profile, demandRefs);
    // 2 client style + 1 logo + 2 demand = 5
    expect(refs).toHaveLength(5);
    expect(refs[0].role).toContain("estilo visual");
    expect(refs[1].role).toContain("estilo visual");
    expect(refs[2].role).toContain("logo da marca");
    expect(refs[3].role).toBe("este é o produto em destaque");
    expect(refs[4].role).toBeNull();
  });

  it("logo não aparece em modo composite", () => {
    const profile: CreativeProfile = {
      ...profileWithStyleRefs,
      logo_mode: "composite",
    };
    const refs = buildOrderedRefs(profile, demandRefs);
    // 2 client style + 2 demand = 4 (sem logo)
    expect(refs).toHaveLength(4);
    expect(refs.some((r) => r.role?.includes("logo"))).toBe(false);
  });

  it("apenas demand refs (sem cliente)", () => {
    const refs = buildOrderedRefs(baseProfile, demandRefs);
    expect(refs).toHaveLength(2);
    expect(refs[0].role).toBe("este é o produto em destaque");
    expect(refs[1].role).toBeNull();
  });
});

describe("buildReferenceBlock", () => {
  it("retorna string vazia se não há refs", () => {
    expect(buildReferenceBlock([])).toBe("");
  });

  it("numera as referências a partir de 1", () => {
    const block = buildReferenceBlock([
      { role: "siga o estilo" },
      { role: null },
    ]);
    expect(block).toContain("Imagem 1:");
    expect(block).toContain("Imagem 2:");
  });

  it("usa fallback para role null", () => {
    const block = buildReferenceBlock([{ role: null }]);
    expect(block).toContain("use como referência visual");
  });

  it("total de referências bate com buildOrderedRefs", () => {
    const profile: CreativeProfile = {
      ...baseProfile,
      logo_mode: "reference",
      style_reference_urls: ["https://example.com/s1.jpg"],
    };
    const demandRefs: DemandReference[] = [
      { url: "https://example.com/d1.jpg", role: "produto" },
    ];
    const ordered = buildOrderedRefs(profile, demandRefs);
    const block = buildReferenceBlock(ordered);
    // 1 style + 1 logo + 1 demand = 3
    expect(ordered).toHaveLength(3);
    expect(block).toContain("Imagem 3:");
  });
});
