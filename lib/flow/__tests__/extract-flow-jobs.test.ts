import { describe, expect, it } from "vitest";
import { gerarFluxoDaDemanda } from "@/lib/flow/generator";
import { extractFlowJobParams } from "@/lib/flow/extract-flow-jobs";
import type { CreativeDemand } from "@/types/demand";

const demanda = {
  id: "demand-1",
  client_id: "client-1",
  briefing: { titulo: "Campanha teste", tipo: "Feed" },
  artes: [
    {
      headline: "Headline original",
      subheadline: null,
      cta: null,
      informacoesExtras: null,
    },
  ],
} as unknown as Pick<CreativeDemand, "id" | "client_id" | "artes" | "briefing">;

describe("extractFlowJobParams", () => {
  it("inclui referências conectadas ao nó Gerar e ao Prompt", () => {
    const graph = gerarFluxoDaDemanda(demanda, 1);

    const logoNode = graph.nodes.find((n) => n.type === "clienteLogo");
    const refsNode = graph.nodes.find((n) => n.type === "clienteReferencias");
    const promptNode = graph.nodes.find((n) => n.type === "promptArte");

    if (logoNode?.type === "clienteLogo") {
      logoNode.data.logoUrl = "https://cdn/logo.png";
    }
    if (refsNode?.type === "clienteReferencias") {
      refsNode.data.referenceUrls = [
        "https://cdn/ref-a.png",
        "https://cdn/ref-b.png",
      ];
    }

    graph.nodes.push({
      id: "ref-produto",
      type: "referenciaImagem",
      data: { imageUrl: "https://cdn/produto.png", label: "produto" },
      position: { x: 0, y: 300 },
    });
    graph.edges.push({ id: "e-ref-prompt", source: "ref-produto", target: "prompt_0" });

    if (promptNode?.type === "promptArte") {
      promptNode.data.promptText =
        "Headline: Promo verão\nExtras: destaque @(produto) no centro";
    }

    const [job] = extractFlowJobParams(graph, demanda.briefing);

    expect(job.flow_logo_url).toBe("https://cdn/logo.png");
    expect(job.flow_references.map((ref) => ref.url)).toEqual([
      "https://cdn/produto.png",
      "https://cdn/ref-a.png",
      "https://cdn/ref-b.png",
    ]);
    expect(job.informacoesExtras).toContain("destaque produto no centro");
  });

  it("usa promptText salvo no nó de prompt", () => {
    const graph = gerarFluxoDaDemanda(demanda, 1);
    const promptNode = graph.nodes.find((n) => n.type === "promptArte");

    if (promptNode?.type === "promptArte") {
      promptNode.data.promptText = "Headline: Texto via promptText";
    }

    const [job] = extractFlowJobParams(graph, demanda.briefing);
    expect(job.headline).toBe("Texto via promptText");
  });
});
