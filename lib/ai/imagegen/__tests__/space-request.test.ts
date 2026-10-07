import { describe, expect, it } from "vitest";
import {
  buildSpaceRequest,
  spacePromptFor,
  spaceReferencesFor,
  SPACE_MAX_COUNT,
} from "../space-request";
import { CATEGORY_META, upgradeLegacyInstructions } from "@/lib/image-library/categories";

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

  it("ordem: sujeito → logo → sem categoria → estilo; sem duplicar", () => {
    const req = buildSpaceRequest(
      {
        flow_logo_url: "https://x/logo.png",
        logo_directive: "logo no topo",
        flow_references: [
          { url: "https://x/estilo.png", role: "estilo", category: "style" },
          { url: "https://x/solta.png", role: "solta" },
          { url: "https://x/pessoa.png", role: "pessoa", category: "subject" },
          { url: "https://x/estilo.png", role: "duplicada", category: "style" },
          { url: "https://x/logo.png", role: "logo de novo" },
        ],
      },
      defaults
    );
    expect(req.references.map((r) => [r.label, r.intent])).toEqual([
      ["Sujeito/produto", "pessoa"],
      ["Logo", "logo no topo"],
      ["Referência", "solta"],
      ["Estilo", "estilo"],
    ]);
  });

  it("no fan-out, o item entra como Imagem 1 da sua geração", () => {
    const req = buildSpaceRequest(
      { flow_logo_url: "https://x/logo.png", fanout_reference_urls: ["https://x/i1.png"] },
      defaults
    );
    const refs = spaceReferencesFor(req, req.batch[0]);
    expect(refs.map((r) => r.kind)).toEqual(["item", "logo"]);
    expect(spacePromptFor(req, req.batch[0])).toContain("- Imagem 1 (Item da lista)");
  });

  it("o prompt do node ABRE; as imagens vêm depois, numeradas na ordem enviada", () => {
    const req = buildSpaceRequest(
      {
        prompt_text: "cena",
        flow_references: [{ url: "https://x/a.png", role: "replique o layout", category: "style" }],
      },
      defaults
    );
    const prompt = spacePromptFor(req, null);
    expect(prompt.startsWith("cena")).toBe(true);
    expect(prompt).toContain("- Imagem 1 (Estilo): replique o layout");
    expect(prompt.indexOf("cena")).toBeLessThan(prompt.indexOf("IMAGENS ANEXADAS"));
  });

  it("prompt_text é o corpo literal: nada descartado, nada injetado por fora", () => {
    const text =
      "Headline escrita em papel com caneta vermelha, fixado numa lousa de rolha. Headline: TEM MEDO?\nSubheadline: Sub.\nCTA: ENTENDA";
    const req = buildSpaceRequest(
      {
        prompt_text: text,
        headline: "TEM MEDO?",
        subheadline: "Sub.",
        cta: "ENTENDA",
        briefing_titulo: "[ARTES] Campanha",
      },
      defaults
    );
    expect(req.body).toBe(`${text}\n\nFormato: proporção 4:5, resolução 2K.`);
    expect(req.body).not.toContain("Campanha");
    expect(req.body).not.toContain("botão gráfico");
  });

  it("sem referências o prompt é só o corpo", () => {
    const req = buildSpaceRequest({ informacoesExtras: "cena" }, defaults);
    expect(spacePromptFor(req, null).startsWith("cena")).toBe(true);
  });
});

describe("upgradeLegacyInstructions", () => {
  it("troca a instrução antiga de estilo (que mandava NÃO seguir a imagem)", () => {
    const old =
      "@(estilo) — é só inspiração de estilo (luz, tratamento, composição geral): não copie textos, logos nem elementos literais. Destaque do dr";
    const up = upgradeLegacyInstructions(old);
    expect(up).toBe(`@(estilo) — ${CATEGORY_META.style.instruction}. Destaque do dr`);
    expect(up).not.toContain("só inspiração");
  });

  it("não mexe em texto escrito pelo operador", () => {
    expect(upgradeLegacyInstructions("fundo azul, luz suave")).toBe("fundo azul, luz suave");
  });
});
