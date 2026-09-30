import { describe, expect, it } from "vitest";
import { buildMagnificSpaceQuery } from "../build-space-query";
import type { DemandArte } from "@/types/demand";

function arte(headline: string): DemandArte {
  return {
    headline,
    subheadline: "",
    informacoesExtras: "",
    cta: "",
    linkReferencias: "",
    imagensReferencias: [],
  };
}

describe("buildMagnificSpaceQuery — imagens do acervo por arte", () => {
  it("menciona cada imagem na arte certa com a instrução da categoria", () => {
    const query = buildMagnificSpaceQuery([arte("A"), arte("B")], null, "logo-1", [
      { arteIndex: 1, category: "style", identifier: "img-9" },
      { arteIndex: 0, category: "subject", identifier: "img-3" },
      { arteIndex: 1, category: "environment", identifier: "img-4" },
    ]);

    expect(query).toContain("Imagens de referência de cada arte");
    expect(query).toMatch(/Arte 1 — @\[img-3:Sujeito:output\] é o sujeito\/produto principal/);
    expect(query).toMatch(
      /Arte 2 — @\[img-9:Estilo:output\] é só inspiração de estilo.*; @\[img-4:Ambiente:output\] é inspiração de ambiente/
    );
  });

  it("usa o rótulo 'Arte' quando a demanda tem uma arte só", () => {
    const query = buildMagnificSpaceQuery([arte("A")], null, null, [
      { arteIndex: 0, category: "brand", identifier: "img-1" },
    ]);
    expect(query).toContain("Arte — @[img-1:Marca:output] é identidade da marca");
  });

  it("não adiciona o bloco sem imagens por arte", () => {
    const query = buildMagnificSpaceQuery([arte("A")], null, null);
    expect(query).not.toContain("Imagens de referência de cada arte");
  });

  it("ignora imagens de artes que não existem mais no briefing", () => {
    const query = buildMagnificSpaceQuery([arte("A")], null, null, [
      { arteIndex: 3, category: "style", identifier: "img-x" },
    ]);
    expect(query).not.toContain("img-x");
  });
});
