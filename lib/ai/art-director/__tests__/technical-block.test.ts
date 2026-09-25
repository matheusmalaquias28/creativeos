import { describe, it, expect } from "vitest";
import {
  appendTechnicalBlock,
  buildReferenceBlock,
  buildTextBlock,
  SCENE_REQUIREMENT,
} from "../technical-block";

describe("buildReferenceBlock", () => {
  it("enumera na ordem recebida", () => {
    const out = buildReferenceBlock([
      { role: "logo", intent: null },
      { role: "estilo", intent: "a paleta e o contraste desta" },
      { role: "personagem", intent: "o tipo físico desta" },
    ]);
    expect(out).toContain("- Imagem 1: é a logo da marca");
    expect(out).toContain("- Imagem 2: a paleta e o contraste desta");
    expect(out).toContain("- Imagem 3: o tipo físico desta");
  });

  it("cai para o papel genérico quando a IA não escreveu intent", () => {
    expect(buildReferenceBlock([{ role: "layout", intent: null }])).toContain(
      "use como referência de layout"
    );
  });

  it("some quando não há referências", () => {
    expect(buildReferenceBlock([])).toBe("");
  });

  it("nunca deixa a logo virar referência de estilo", () => {
    const out = buildReferenceBlock([{ role: "logo", intent: "copie o estilo" }]);
    expect(out).toContain("não a use como referência de estilo");
  });
});

describe("buildTextBlock", () => {
  it("lista somente os textos fornecidos e proíbe outros TEXTOS", () => {
    const out = buildTextBlock({ headline: "Divórcio sem briga", cta: "Fale agora" });
    expect(out).toContain('- Headline principal: "Divórcio sem briga"');
    expect(out).toContain('- Call-to-action: "Fale agora"');
    expect(out).toContain("Nenhum outro TEXTO pode aparecer");
    expect(out).not.toContain("Subheadline");
  });

  // Regressão do bug que fez o modelo entregar só tipografia e logo sobre fundo
  // liso: a frase antiga ("A IMAGEM DEVE CONTER SOMENTE ESSES TEXTOS, NADA
  // MAIS") era lida como restrição da arte inteira, não do texto.
  it("nunca restringe a imagem, só o texto", () => {
    const out = buildTextBlock({ headline: "oi", cta: "clique" });
    expect(out).not.toContain("A IMAGEM DEVE CONTER SOMENTE");
    expect(out).toContain("SOMENTE para texto");
    expect(out).toContain("os elementos visuais da cena continuam obrigatórios");
  });

  it("preserva a acentuação da copy", () => {
    expect(buildTextBlock({ headline: "Atenção: inscrições até março" })).toContain(
      "Atenção: inscrições até março"
    );
  });

  it("só impõe a regra do botão quando há CTA", () => {
    expect(buildTextBlock({ headline: "oi", cta: "Clique" })).toContain("é um BOTÃO");
    expect(buildTextBlock({ headline: "oi" })).not.toContain("é um BOTÃO");
  });

  it("proíbe texto sem dispensar a cena quando não há copy nenhuma", () => {
    const out = buildTextBlock({});
    expect(out).toContain("Nenhum TEXTO deve aparecer");
    expect(out).toContain("cena visual continua obrigatória");
  });
});

describe("appendTechnicalBlock", () => {
  const prompt = "Plano médio de uma mulher de perfil contra concreto aparente.";

  it("mantém o prompt aprovado na frente", () => {
    const out = appendTechnicalBlock(prompt, { headline: "oi" }, []);
    expect(out.startsWith(prompt)).toBe(true);
  });

  it("anexa formato quando informado", () => {
    const out = appendTechnicalBlock(prompt, { aspectRatio: "3:4", imageSize: "2K" }, []);
    expect(out).toContain("proporção 3:4, resolução 2K");
  });

  it("omite o bloco de formato quando não há spec técnica", () => {
    expect(appendTechnicalBlock(prompt, {}, [])).not.toContain("Produção para redes sociais");
  });

  it("exige cena com profundidade e proíbe fundo liso", () => {
    expect(SCENE_REQUIREMENT).toContain("ocupa o quadro inteiro");
    expect(SCENE_REQUIREMENT).toContain("Fundo liso");
    const out = appendTechnicalBlock(prompt, { headline: "oi" }, []);
    expect(out).toContain(SCENE_REQUIREMENT);
  });

  it("é determinístico", () => {
    const spec = { headline: "a", cta: "b", aspectRatio: "1:1" };
    const refs = [{ role: "estilo" as const, intent: "x" }];
    expect(appendTechnicalBlock(prompt, spec, refs)).toBe(
      appendTechnicalBlock(prompt, spec, refs)
    );
  });
});

// ---------------------------------------------------------------------------
// Formato: 3:4 SEMPRE
// ---------------------------------------------------------------------------

import { ART_ASPECT_RATIO } from "../constants";

describe("ART_ASPECT_RATIO", () => {
  it("é 3:4", () => {
    expect(ART_ASPECT_RATIO).toBe("3:4");
  });

  it("chega ao bloco técnico quando usado no spec", () => {
    const out = appendTechnicalBlock("cena", { aspectRatio: ART_ASPECT_RATIO }, []);
    expect(out).toContain("proporção 3:4");
  });
});
