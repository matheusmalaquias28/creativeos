import { describe, expect, it } from "vitest";
import { gerarFluxoDaDemanda } from "@/lib/flow/generator";
import { extractFlowJobParams } from "@/lib/flow/extract-flow-jobs";
import type { CreativeDemand } from "@/types/demand";
import type { FlowGraph } from "@/lib/flow/types";

/** Grafo mínimo: Lista(ref_a, ref_b) → Gerar → Saída. */
function graphWithList(mode: "reference" | "list"): FlowGraph {
  return {
    nodes: [
      { id: "gerar_0", type: "gerarImagem", data: { aspectRatio: "4:5" }, position: { x: 0, y: 0 } },
      { id: "saida_0", type: "saidaArte", data: { artIndex: 0 }, position: { x: 0, y: 0 } },
      { id: "lista_0", type: "listaImagens", data: { mode }, position: { x: 0, y: 0 } },
      { id: "ref_a", type: "referenciaImagem", data: { imageUrl: "https://cdn/a.png" }, position: { x: 0, y: 0 } },
      { id: "ref_b", type: "referenciaImagem", data: { imageUrl: "https://cdn/b.png" }, position: { x: 0, y: 0 } },
    ],
    edges: [
      { id: "e1", source: "gerar_0", target: "saida_0" },
      { id: "e2", source: "lista_0", target: "gerar_0" },
      { id: "e3", source: "ref_a", target: "lista_0" },
      { id: "e4", source: "ref_b", target: "lista_0" },
    ],
  };
}

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
  it("inclui referências conectadas ao node Arte (logo, refs do cliente e @menção)", () => {
    const graph = gerarFluxoDaDemanda(demanda, 1);

    const logoNode = graph.nodes.find((n) => n.type === "clienteLogo");
    const refsNode = graph.nodes.find((n) => n.type === "clienteReferencias");
    const arteNode = graph.nodes.find((n) => n.type === "arte" && n.data.format === "feed");

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
    graph.edges.push({ id: "e-ref-arte", source: "ref-produto", target: arteNode!.id });

    if (arteNode?.type === "arte") {
      arteNode.data.promptText =
        "Headline: Promo verão\nExtras: destaque @(produto) no centro";
    }

    const [job] = extractFlowJobParams(graph, demanda.briefing);

    expect(job.flow_logo_url).toBe("https://cdn/logo.png");
    // refs do cliente (edge direta) + @(produto) resolvido no prompt.
    expect(job.flow_references.map((ref) => ref.url).sort()).toEqual(
      ["https://cdn/produto.png", "https://cdn/ref-a.png", "https://cdn/ref-b.png"].sort()
    );
    expect(job.informacoesExtras).toContain("destaque produto no centro");
  });

  it("usa promptText salvo no node Arte", () => {
    const graph = gerarFluxoDaDemanda(demanda, 1);
    const arteNode = graph.nodes.find((n) => n.type === "arte" && n.data.format === "feed");

    if (arteNode?.type === "arte") {
      arteNode.data.promptText = "Headline: Texto via promptText";
    }

    const [job] = extractFlowJobParams(graph, demanda.briefing);
    expect(job.headline).toBe("Texto via promptText");
  });

  it("texto livre ao lado de Headline/CTA não é descartado (prompt master)", () => {
    const graph = gerarFluxoDaDemanda(demanda, 1);
    const arteNode = graph.nodes.find((n) => n.type === "arte" && n.data.format === "feed");
    const text =
      "Headline escrita em papel com caneta vermelha, numa lousa de rolha. Headline: TEM MEDO?\nSubheadline: Sub.\nCTA: ENTENDA";
    if (arteNode?.type === "arte") arteNode.data.promptText = text;

    const [job] = extractFlowJobParams(graph, demanda.briefing);
    expect(job.prompt_text).toBe(text);
  });

  it("Lista em modo reference achata os itens como referências", () => {
    const [job] = extractFlowJobParams(graphWithList("reference"), {});
    expect(job.fanout_reference_urls).toBeNull();
    expect(job.flow_references.map((r) => r.url)).toEqual([
      "https://cdn/a.png",
      "https://cdn/b.png",
    ]);
    expect(job.count).toBe(1);
  });

  it("Lista em modo list vira fan-out (1 por item)", () => {
    const [job] = extractFlowJobParams(graphWithList("list"), {});
    expect(job.fanout_reference_urls).toEqual([
      "https://cdn/a.png",
      "https://cdn/b.png",
    ]);
  });

  it("node de stories faz fan-out a partir dos items materializados da lista", () => {
    const graph: FlowGraph = {
      nodes: [
        {
          id: "arte_stories",
          type: "arte",
          data: { artIndex: 2, format: "story", aspectRatio: "9:16", promptText: "Adapte" },
          position: { x: 0, y: 0 },
        },
        {
          id: "lista",
          type: "listaImagens",
          // 4 imagens já geradas, despejadas na lista (materializadas).
          data: {
            mode: "list",
            items: ["https://cdn/1.png", "https://cdn/2.png", "https://cdn/3.png", "https://cdn/4.png"],
          },
          position: { x: 0, y: 0 },
        },
      ],
      edges: [{ id: "e", source: "lista", target: "arte_stories", targetHandle: "refs" }],
    };

    // Full-run ignora stories…
    expect(extractFlowJobParams(graph, {})).toHaveLength(0);

    // …mas com includeStory (disparo no node) gera e faz fan-out das 4 imagens.
    const [job] = extractFlowJobParams(graph, {}, { includeStory: true });
    expect(job.art_index).toBe(2);
    expect(job.skip_logo).toBe(true);
    expect(job.fanout_reference_urls).toHaveLength(4);
  });
});
