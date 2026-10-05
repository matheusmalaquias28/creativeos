import { IMAGE_GEN_DEFAULTS } from "@/lib/ai/imagegen/defaults";
import { BRAND_IDENTITY_LABEL, seedLabeledLineIfMissing } from "@/lib/flow/mention-text";
import { getPromptArteEditorText } from "@/lib/flow/prompt-arte-text";
import type { FlowGraph } from "@/lib/flow/types";

type CreativeProfileRow = {
  logo_url: string | null;
  style_reference_urls: string[] | null;
  base_prompt?: string | null;
  palette?: string[] | null;
};

export function enrichFlowGraphWithProfile(
  graph: FlowGraph,
  profile: CreativeProfileRow | null
): FlowGraph {
  if (!profile) return graph;

  const brandContent = [
    profile.base_prompt?.trim() || null,
    profile.palette?.length ? `paleta ${profile.palette.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" — ");

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
      if (node.type === "gerarImagem") {
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
        };
      }
      if (node.type === "arte") {
        // Só preenche o que o operador NÃO definiu no node — nunca sobrescreve
        // os controles escolhidos (formato/esforço/resolução/quantidade).
        const d = node.data;
        const withDefaults = {
          ...d,
          aspectRatio: d.aspectRatio ?? IMAGE_GEN_DEFAULTS.aspectRatio,
          imageSize: d.imageSize ?? IMAGE_GEN_DEFAULTS.imageSize,
          model: d.model ?? IMAGE_GEN_DEFAULTS.model,
          quality: d.quality ?? IMAGE_GEN_DEFAULTS.quality,
        };
        // Base_prompt/paleta do cliente nunca entram escondidos no prompt
        // final — semeia uma linha editável/removível no texto do node, UMA
        // vez só (flag persistida): depois disso o texto no canvas manda,
        // nunca sobrescreve o que o operador editou ou apagou.
        if (brandContent && !withDefaults.brandIdentitySeeded) {
          const text = getPromptArteEditorText(withDefaults);
          withDefaults.promptText = seedLabeledLineIfMissing(text, BRAND_IDENTITY_LABEL, brandContent);
          withDefaults.brandIdentitySeeded = true;
        }
        return { ...node, data: withDefaults };
      }
      return node;
    }),
  };
}
