import { describe, expect, it } from "vitest";
import { buildSpaceRequest, spaceReferencesFor, SPACE_MAX_COUNT } from "../space-request";

const defaults = { aspectRatio: "4:5", imageSize: "2K" };

describe("buildSpaceRequest", () => {
  it("fan-out da Lista gera 1 por item, sem teto", () => {
    const urls = Array.from({ length: 12 }, (_, i) => `https://x/${i}.png`);
    const req = buildSpaceRequest({ fanout_reference_urls: urls, count: 2 }, defaults);
    expect(req.batch).toHaveLength(12);
    expect(req.batch.every((b) => b?.kind === "item")).toBe(true);
  });

  it("variações (count) respeitam o teto", () => {
    const req = buildSpaceRequest({ count: 50 }, defaults);
    expect(req.batch).toHaveLength(SPACE_MAX_COUNT);
    expect(req.batch.every((b) => b === null)).toBe(true);
  });

  it("sem logo conectada não manda logo nenhuma", () => {
    const req = buildSpaceRequest({ flow_logo_url: null, informacoesExtras: "fundo azul" }, defaults);
    expect(req.references).toHaveLength(0);
    expect(req.logoUrl).toBeNull();
  });

  it("logo vai primeiro com a frase do prompt; refs na sequência, sem duplicar", () => {
    const req = buildSpaceRequest(
      {
        flow_logo_url: "https://x/logo.png",
        logo_directive: "logo no topo",
        flow_references: [
          { url: "https://x/a.png", role: "estilo" },
          { url: "https://x/a.png", role: "duplicada" },
          { url: "https://x/logo.png", role: "logo de novo" },
        ],
      },
      defaults
    );
    expect(req.references.map((r) => [r.kind, r.intent])).toEqual([
      ["logo", "logo no topo"],
      ["ref", "estilo"],
    ]);
  });

  it("no fan-out, o item entra como Imagem 1 da sua geração", () => {
    const req = buildSpaceRequest(
      { flow_logo_url: "https://x/logo.png", fanout_reference_urls: ["https://x/i1.png"] },
      defaults
    );
    const refs = spaceReferencesFor(req, req.batch[0]);
    expect(refs.map((r) => r.kind)).toEqual(["item", "logo"]);
  });

  it("o prompt não carrega bloco de referências próprio (o provedor numera)", () => {
    const req = buildSpaceRequest(
      { informacoesExtras: "cena", flow_references: [{ url: "https://x/a.png", role: "estilo" }] },
      defaults
    );
    expect(req.prompt).not.toContain("Crie a arte usando as imagens");
    expect(req.prompt.startsWith("cena")).toBe(true);
  });
});
