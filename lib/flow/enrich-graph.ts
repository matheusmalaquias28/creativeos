import { IMAGE_GEN_DEFAULTS } from "@/lib/ai/imagegen/defaults";
import type { FlowGraph } from "@/lib/flow/types";

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
      if (node.type === "clienteLogo") {
        return {
          ...node,
          data: {
            ...node.data,
            logoUrl: node.data.logoUrl ?? profile.logo_url,
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
            referenceUrls:
              existing.length > 0 ? existing : fromProfile,
          },
        };
      }
      if (node.type === "gerarImagem") {
        return {
          ...node,
          data: {
            ...node.data,
            aspectRatio: IMAGE_GEN_DEFAULTS.aspectRatio,
            imageSize: IMAGE_GEN_DEFAULTS.imageSize,
            model: IMAGE_GEN_DEFAULTS.model,
            quality: IMAGE_GEN_DEFAULTS.quality,
          },
        };
      }
      return node;
    }),
  };
}
