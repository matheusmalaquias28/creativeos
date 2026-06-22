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
      return node;
    }),
  };
}
