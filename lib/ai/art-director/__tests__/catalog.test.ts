import { describe, it, expect } from "vitest";
import {
  buildReferenceCatalog,
  describeUsage,
  sortForCatalog,
  applyWinnerQuota,
} from "../catalog";
import type { ReferenceAsset } from "../types";

const NOW = new Date("2026-09-24T12:00:00Z");

function asset(over: Partial<ReferenceAsset> & { id: string }): ReferenceAsset {
  return {
    kind: "estilo",
    storageUrl: `https://cdn/${over.id}.png`,
    aiDescription: "Foto noturna urbana, neon refletido em asfalto molhado",
    aiTags: ["noturno", "neon"],
    usageCount: 0,
    lastUsedAt: null,
    isWinner: false,
    ...over,
  };
}

describe("describeUsage", () => {
  it("marca asset nunca usado", () => {
    expect(describeUsage(asset({ id: "a" }), NOW)).toBe("nunca usada");
  });

  it("conta dias desde o último uso", () => {
    const a = asset({ id: "a", usageCount: 7, lastUsedAt: "2026-09-22T12:00:00Z" });
    expect(describeUsage(a, NOW)).toBe("usada 7x, última há 2 dias");
  });

  it("usa 'ontem' e 'hoje' em vez de contagem", () => {
    expect(
      describeUsage(asset({ id: "a", usageCount: 1, lastUsedAt: "2026-09-23T12:00:00Z" }), NOW)
    ).toBe("usada 1x, última ontem");
    expect(
      describeUsage(asset({ id: "b", usageCount: 3, lastUsedAt: "2026-09-24T09:00:00Z" }), NOW)
    ).toBe("usada 3x, última hoje");
  });
});

describe("sortForCatalog", () => {
  it("põe subusado antes de usado", () => {
    const out = sortForCatalog([
      asset({ id: "muito", usageCount: 9 }),
      asset({ id: "pouco", usageCount: 1 }),
      asset({ id: "zero", usageCount: 0 }),
    ]);
    expect(out.map((a) => a.id)).toEqual(["zero", "pouco", "muito"]);
  });

  it("desempata winner depois de não-winner", () => {
    const out = sortForCatalog([
      asset({ id: "aaa", usageCount: 0, isWinner: true }),
      asset({ id: "zzz", usageCount: 0, isWinner: false }),
    ]);
    expect(out[0].id).toBe("zzz");
  });

  it("é determinístico para entradas equivalentes", () => {
    const input = [asset({ id: "b" }), asset({ id: "a" }), asset({ id: "c" })];
    expect(sortForCatalog(input).map((a) => a.id)).toEqual(
      sortForCatalog([...input].reverse()).map((a) => a.id)
    );
  });
});

describe("applyWinnerQuota", () => {
  it("limita winners a metade do teto", () => {
    const assets = [
      ...Array.from({ length: 8 }, (_, i) => asset({ id: `w${i}`, isWinner: true })),
      ...Array.from({ length: 8 }, (_, i) => asset({ id: `n${i}` })),
    ];
    const out = applyWinnerQuota(assets, 10);
    expect(out).toHaveLength(10);
    expect(out.filter((a) => a.isWinner)).toHaveLength(5);
  });

  it("não inventa itens quando o acervo é menor que o teto", () => {
    expect(applyWinnerQuota([asset({ id: "a" })], 10)).toHaveLength(1);
  });
});

describe("buildReferenceCatalog", () => {
  it("emite tokens posicionais estáveis", () => {
    const catalog = buildReferenceCatalog(
      [asset({ id: "x" }), asset({ id: "y" }), asset({ id: "z" })],
      NOW
    );
    expect(catalog.entries.map((e) => e.token)).toEqual(["r01", "r02", "r03"]);
    expect(catalog.byToken.get("r01")?.id).toBe("x");
  });

  it("inclui kind, descrição, tags e uso em cada linha", () => {
    const catalog = buildReferenceCatalog(
      [asset({ id: "x", kind: "layout", usageCount: 2, lastUsedAt: "2026-09-20T12:00:00Z" })],
      NOW
    );
    expect(catalog.text).toContain("r01 | layout |");
    expect(catalog.text).toContain("[noturno, neon]");
    expect(catalog.text).toContain("usada 2x, última há 4 dias");
  });

  it("marca artes aprovadas promovidas ao acervo", () => {
    const catalog = buildReferenceCatalog([asset({ id: "x", isWinner: true })], NOW);
    expect(catalog.text).toContain("arte aprovada do próprio cliente");
  });

  it("degrada sem quebrar quando o acervo está vazio", () => {
    const catalog = buildReferenceCatalog([], NOW);
    expect(catalog.text).toBe("(acervo vazio)");
    expect(catalog.entries).toHaveLength(0);
  });

  it("respeita o limite de itens", () => {
    const assets = Array.from({ length: 60 }, (_, i) => asset({ id: `a${i}` }));
    expect(buildReferenceCatalog(assets, NOW, 12).entries).toHaveLength(12);
  });
});

// ---------------------------------------------------------------------------
// resolvePalette — a paleta vem da coluna OU do DNA (perfis extraídos antes do
// backfill só têm as cores dentro do visual_identity_dna).
// ---------------------------------------------------------------------------

import { resolvePalette } from "../prepare";
import type { VisualIdentityDna } from "@/lib/schemas/visual-identity";

function dnaWith(palette: string[]): VisualIdentityDna {
  return { palette } as unknown as VisualIdentityDna;
}

describe("resolvePalette", () => {
  it("prefere a coluna palette quando preenchida", () => {
    expect(resolvePalette(["#111111", "#222222"], dnaWith(["#333333"]))).toEqual([
      "#111111",
      "#222222",
    ]);
  });

  it("cai no DNA quando a coluna está vazia", () => {
    expect(resolvePalette([], dnaWith(["#333333", "#444444"]))).toEqual([
      "#333333",
      "#444444",
    ]);
  });

  it("cai no DNA quando a coluna é null", () => {
    expect(resolvePalette(null, dnaWith(["#555555"]))).toEqual(["#555555"]);
  });

  it("devolve vazio quando não há nenhuma das duas", () => {
    expect(resolvePalette(null, null)).toEqual([]);
  });
});
