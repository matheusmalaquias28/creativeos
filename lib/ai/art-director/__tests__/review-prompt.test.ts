import { describe, expect, it } from "vitest";
import { buildReviewPrompt } from "../review-art";

describe("buildReviewPrompt", () => {
  it("no Space julga pelo prompt do node, não pelos campos parseados", () => {
    const master = "Headline: TEM MEDO?\nCTA CENTRALIZADA NA COR VERDE: FALE COM UM ADVOGADO";
    const prompt = buildReviewPrompt({ cta: "https://drive.google.com/link-errado" }, master);
    expect(prompt).toContain(master);
    expect(prompt).not.toContain("link-errado");
    expect(prompt).not.toContain("top centre");
  });

  it("sem prompt master mantém a revisão clássica pelos campos", () => {
    const prompt = buildReviewPrompt({ cta: "SAIBA MAIS" }, null);
    expect(prompt).toContain('"SAIBA MAIS"');
  });
});
