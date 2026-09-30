import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/ai/client", () => ({ getAnthropicClient: vi.fn() }));
vi.mock("../vision", () => ({ urlToVisionBlock: vi.fn() }));
import { buildUserPrompt, resolveReferences } from "../direct-art";
import { resolveVisualMode } from "../visual-policy";
import { buildReferenceCatalog } from "../catalog";
import type { ArtDirectionInput } from "../types";

const input: ArtDirectionInput = {
  client: { name: "Cliente novo", dna: null, basePrompt: "", palette: [], directionNotes: [], visualMode: "free" },
  catalog: buildReferenceCatalog([]), demand: { titulo: null, tipo: null },
  art: { index: 0, headline: "Sua próxima conquista começa aqui", cta: "Saiba mais", aspectRatio: "3:4", imageSize: "2K" },
  siblings: [], clientPhotos: [],
};
describe("copy-first direction", () => {
  it("defaults new clients to free while preserving legacy identity", () => {
    expect(resolveVisualMode(undefined, false)).toBe("free");
    expect(resolveVisualMode(undefined, true)).toBe("brand");
    expect(resolveVisualMode("free", true)).toBe("free");
  });
  it("can direct copy without identity or references", () => {
    const prompt = buildUserPrompt(input);
    expect(prompt).toContain(input.art.headline);
    expect(prompt).toContain("Create an original visual direction");
    expect(prompt).not.toContain("ASSIGNED LAYOUT MASTER");
    expect(resolveReferences([], input)).toEqual([]);
  });
  it("keeps campaign observations separate from literal copy", () => {
    const prompt = buildUserPrompt({ ...input, steer: "Fundo claro com respiro" });
    expect(prompt).toContain("## OPERATOR DIRECTION (highest priority)\nFundo claro com respiro");
    expect(prompt).not.toContain('Extra line: "Fundo claro com respiro"');
  });
  it("does not promote a product reference to layout", () => {
    const catalog = buildReferenceCatalog([{ id: "product", kind: "produto", storageUrl: "https://example.com/product.png", aiDescription: null, aiTags: [], usageCount: 0, lastUsedAt: null, isWinner: false }]);
    const refs = resolveReferences([{ token: "r01", role: "produto", intent: "preserve product" }], { ...input, catalog });
    expect(refs[0].role).toBe("produto");
  });
});
