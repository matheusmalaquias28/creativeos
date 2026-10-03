import { IMAGE_GEN_DEFAULTS } from "@/lib/ai/imagegen/defaults";
import type { FlowGraph, FlowNode } from "@/lib/flow/types";

type CreativeProfileRow = {
  logo_url: string | null;
  style_reference_urls: string[] | null;
};

export function enrichFlowGraphWithProfile(
  graph: FlowGraph,
  profile: CreativeProfileRow | null
): FlowGraph {
  if (!profile) return graph;

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      // Nodes de logo/referências do cliente espelham o perfil: o PERFIL vence
      // (atualizar o material do cliente e regerar reflete no Space). Mantém o
      // valor do node só quando o perfil não tem nada.
      if (node.type === "clienteLogo") {
        return {
          ...node,
          data: {
            ...node.data,
            logoUrl: profile.logo_url ?? node.data.logoUrl ?? null,
          },
        };
      }
      if (node.type === "clienteReferencias") {
        const existing = node.data.referenceUrls ?? [];
        const fromProfile = profile.style_reference_urls ?? [];
        return {
          ...node,
          data: {
            ...node.data,
            referenceUrls: fromProfile.length > 0 ? fromProfile : existing,
          },
        };
      }
      if (node.type === "gerarImagem" || node.type === "arte") {
        // Só preenche o que o operador NÃO definiu no node — nunca sobrescreve
        // os controles escolhidos (formato/esforço/resolução/quantidade).
        const d = node.data;
        return {
          ...node,
          data: {
            ...d,
            aspectRatio: d.aspectRatio ?? IMAGE_GEN_DEFAULTS.aspectRatio,
            imageSize: d.imageSize ?? IMAGE_GEN_DEFAULTS.imageSize,
            model: d.model ?? IMAGE_GEN_DEFAULTS.model,
            quality: d.quality ?? IMAGE_GEN_DEFAULTS.quality,
          },
        } as FlowNode;
      }
      return node;
    }),
  };
}
