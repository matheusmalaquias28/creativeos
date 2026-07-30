import { describe, expect, it } from "vitest";
import { buildMvpSpaceQueryBatches } from "../build-mvp-query";
import type { MvpPage } from "@/types/mvp";

const SUFFIX_MARGIN = 200; // sufixo "NÃO renomeie este Space..." adicionado no envio

function makePage(index: number, paragraphChars: number): MvpPage {
  return {
    index,
    title: `Página ${index + 1}`,
    blocks: [
      { type: "title", text: `Título da página ${index + 1}` },
      { type: "paragraph", text: "x".repeat(paragraphChars) },
    ],
    referenceUrls: [],
  };
}

describe("buildMvpSpaceQueryBatches", () => {
  it("cabe em um lote quando o conteúdo é pequeno", () => {
    const batches = buildMvpSpaceQueryBatches([makePage(0, 200), makePage(1, 200)], "logo-id", []);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toContain("Crie 2 nodes");
  });

  it("divide em lotes e nenhum passa de 4000 chars (com margem para o sufixo)", () => {
    const pages = Array.from({ length: 20 }, (_, i) => makePage(i, 900));
    const references = [
      { identifier: "a".repeat(30), label: "Ref 1" },
      { identifier: "b".repeat(30), label: "Ref 2" },
    ];
    const batches = buildMvpSpaceQueryBatches(pages, "c".repeat(30), references);

    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(4000 - SUFFIX_MARGIN);
    }
    // primeiro lote cria, os demais adicionam mantendo a identidade
    expect(batches[0]).toMatch(/^Crie /);
    for (const batch of batches.slice(1)) {
      expect(batch).toMatch(/^Adicione mais /);
    }
    // todas as páginas aparecem em algum lote
    const joined = batches.join("\n");
    for (const page of pages) {
      expect(joined).toContain(`--- Página ${page.index + 1}:`);
    }
    // referências conectadas em todos os lotes
    for (const batch of batches) {
      expect(batch).toContain("Ref 1");
      expect(batch).toContain("Logo");
    }
  });

  it("corta a copy de uma página que sozinha estoura o orçamento", () => {
    const batches = buildMvpSpaceQueryBatches([makePage(0, 6000)], null, []);
    expect(batches).toHaveLength(1);
    expect(batches[0].length).toBeLessThanOrEqual(4000 - SUFFIX_MARGIN);
  });
});
