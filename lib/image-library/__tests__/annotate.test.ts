import { describe, expect, it } from "vitest";
import { normalizeLibraryAnnotation } from "../annotate";

describe("normalizeLibraryAnnotation", () => {
  it("normaliza tags e aceita categoria válida", () => {
    const out = normalizeLibraryAnnotation({
      description: " Advogado de terno em escritório ",
      tags: ["Advogado", "advogado", " Terno ", 3],
      category: "Subject",
    });
    expect(out).toEqual({
      description: "Advogado de terno em escritório",
      tags: ["advogado", "terno"],
      suggestedCategory: "subject",
    });
  });

  it("descarta categoria desconhecida sem falhar", () => {
    expect(normalizeLibraryAnnotation({ description: "x", category: "layout" }).suggestedCategory).toBeNull();
  });

  it("falha sem descrição", () => {
    expect(() => normalizeLibraryAnnotation({ tags: ["a"] })).toThrow();
  });
});
