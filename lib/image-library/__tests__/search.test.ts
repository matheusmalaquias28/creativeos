import { describe, expect, it } from "vitest";
import { filterLibraryImages } from "../search";

const images = [
  { id: "1", ai_description: "Advogada sorrindo em escritório claro", ai_tags: ["advogada", "escritório"], file_name: "a.jpg" },
  { id: "2", ai_description: "Balança da justiça dourada", ai_tags: ["balança", "justiça"], file_name: "b.jpg" },
  { id: "3", ai_description: null, ai_tags: [], file_name: "biblioteca-juridica.png" },
];

describe("filterLibraryImages", () => {
  it("devolve tudo com busca vazia", () => {
    expect(filterLibraryImages(images, "  ")).toHaveLength(3);
  });

  it("ignora acentos e caixa", () => {
    expect(filterLibraryImages(images, "BALANCA justica").map((i) => i.id)).toEqual(["2"]);
  });

  it("exige todos os termos", () => {
    expect(filterLibraryImages(images, "advogada balança")).toHaveLength(0);
  });

  it("acha pelo nome do arquivo quando não há anotação", () => {
    expect(filterLibraryImages(images, "biblioteca").map((i) => i.id)).toEqual(["3"]);
  });
});
