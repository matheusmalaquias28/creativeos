import { describe, it, expect } from "vitest";
import { enforceDistinctReferenceSets, type ArtReferenceSet } from "../dedupe";
import { buildReferenceCatalog } from "../catalog";
import type { ChosenReference, ReferenceAsset } from "../types";

function asset(id: string, usageCount = 0): ReferenceAsset {
  return {
    id,
    kind: "estilo",
    storageUrl: `https://cdn/${id}.png`,
    aiDescription: `ref ${id}`,
    aiTags: [],
    usageCount,
    lastUsedAt: usageCount > 0 ? "2026-09-20T12:00:00Z" : null,
    isWinner: false,
  };
}

function ref(id: string): ChosenReference {
  return { assetId: id, storageUrl: `https://cdn/${id}.png`, role: "estilo", intent: "x" };
}

const pool = [asset("a", 5), asset("b", 4), asset("c", 0), asset("d", 0), asset("e", 0)];
const catalog = buildReferenceCatalog(pool, new Date("2026-09-24T12:00:00Z"));

describe("enforceDistinctReferenceSets", () => {
  it("deixa conjuntos já distintos intactos", () => {
    const sets: ArtReferenceSet[] = [
      { artIndex: 0, references: [ref("a"), ref("b")] },
      { artIndex: 1, references: [ref("c"), ref("d")] },
    ];
    const out = enforceDistinctReferenceSets(sets, catalog);
    expect(out.warnings).toHaveLength(0);
    expect(out.sets[0].references.map((r) => r.assetId)).toEqual(["a", "b"]);
    expect(out.sets[1].references.map((r) => r.assetId)).toEqual(["c", "d"]);
  });

  it("quebra conjuntos idênticos entre artes da mesma demanda", () => {
    const sets: ArtReferenceSet[] = [
      { artIndex: 0, references: [ref("a"), ref("b")] },
      { artIndex: 1, references: [ref("a"), ref("b")] },
    ];
    const out = enforceDistinctReferenceSets(sets, catalog);
    const first = out.sets[0].references.map((r) => r.assetId).sort();
    const second = out.sets[1].references.map((r) => r.assetId).sort();
    expect(first).not.toEqual(second);
    expect(out.warnings).toHaveLength(0);
  });

  it("troca a referência mais gasta, não a primeira", () => {
    const sets: ArtReferenceSet[] = [
      { artIndex: 0, references: [ref("a"), ref("b")] },
      { artIndex: 1, references: [ref("a"), ref("b")] },
    ];
    const out = enforceDistinctReferenceSets(sets, catalog);
    // 'a' tem usageCount 5, 'b' tem 4 — 'a' é a vítima
    expect(out.sets[1].references.map((r) => r.assetId)).toContain("b");
    expect(out.sets[1].references.map((r) => r.assetId)).not.toContain("a");
  });

  it("prefere o candidato menos usado na troca", () => {
    const sets: ArtReferenceSet[] = [
      { artIndex: 0, references: [ref("a"), ref("b")] },
      { artIndex: 1, references: [ref("a"), ref("b")] },
    ];
    const out = enforceDistinctReferenceSets(sets, catalog);
    const replaced = out.sets[1].references.find((r) => r.assetId !== "b");
    expect(["c", "d", "e"]).toContain(replaced?.assetId);
  });

  it("ignora a ordem interna ao comparar conjuntos", () => {
    const sets: ArtReferenceSet[] = [
      { artIndex: 0, references: [ref("a"), ref("b")] },
      { artIndex: 1, references: [ref("b"), ref("a")] },
    ];
    const out = enforceDistinctReferenceSets(sets, catalog);
    const first = out.sets[0].references.map((r) => r.assetId).sort().join();
    const second = out.sets[1].references.map((r) => r.assetId).sort().join();
    expect(first).not.toBe(second);
  });

  it("avisa em vez de travar quando o acervo é pequeno demais", () => {
    const tiny = buildReferenceCatalog([asset("a")], new Date("2026-09-24T12:00:00Z"));
    const sets: ArtReferenceSet[] = [
      { artIndex: 0, references: [ref("a")] },
      { artIndex: 1, references: [ref("a")] },
    ];
    const out = enforceDistinctReferenceSets(sets, tiny);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toContain("Arte 1");
    expect(out.sets).toHaveLength(2);
  });

  it("aguenta uma demanda de 5 artes sem colisão", () => {
    const sets: ArtReferenceSet[] = Array.from({ length: 5 }, (_, i) => ({
      artIndex: i,
      references: [ref("a"), ref("b")],
    }));
    const out = enforceDistinctReferenceSets(sets, catalog);
    const sigs = out.sets.map((s) => s.references.map((r) => r.assetId).sort().join("|"));
    expect(new Set(sigs).size).toBeGreaterThan(1);
  });
});
