import { IMAGE_GEN_DEFAULTS } from "@/lib/ai/imagegen/defaults";
import { BRAND_IDENTITY_LABEL, seedLabeledLineIfMissing } from "@/lib/flow/mention-text";
import { getPromptArteEditorText } from "@/lib/flow/prompt-arte-text";
import { upgradeLegacyInstructions } from "@/lib/image-library/categories";
import { LEGACY_STORY_PROMPTS, STORY_PROMPT, STORY_QUALITY } from "@/lib/flow/story-defaults";
import type { ArteData, FlowGraph, FlowNode, ReferenciaImagemData } from "@/lib/flow/types";

type CreativeProfileRow = {
  logo_url: string | null;
  style_reference_urls: string[] | null;
  base_prompt?: string | null;
  palette?: string[] | null;
};

/**
 * Troca as instruções antigas das categorias do acervo (ver
 * `upgradeLegacyInstructions`) no texto dos prompts e no `intent` das
 * referências. Fica visível no node — o texto é a fonte da geração.
 */
function upgradeReferenceInstructions(node: FlowNode): FlowNode {
  if (node.type === "arte") {
    const d = node.data as ArteData;
    const fields = ["promptText", "headline", "subheadline", "cta", "informacoesExtras"] as const;
    let changed = false;
    const next: ArteData = { ...d };
    for (const f of fields) {
      const v = d[f];
      if (typeof v !== "string") continue;
      const up = upgradeLegacyInstructions(v);
      if (up !== v) {
        next[f] = up;
        changed = true;
      }
    }
    return changed ? { ...node, data: next } : node;
  }
  if (node.type === "referenciaImagem") {
    const d = node.data as ReferenciaImagemData;
    const intent = d.intent ? upgradeLegacyInstructions(d.intent) : d.intent;
    return intent !== d.intent ? { ...node, data: { ...d, intent } } : node;
  }
  return node;
}

/**
 * Node de stories: texto padrão antigo vira o novo (só se o operador não mexeu
 * nele) e o esforço é sempre low. Fica visível no node.
 */
function upgradeStoryNode(node: FlowNode): FlowNode {
  if (node.type !== "arte" || node.data.format !== "story") return node;
  const d = node.data as ArteData;
  const legacy = typeof d.promptText === "string" && LEGACY_STORY_PROMPTS.includes(d.promptText.trim());
  if (!legacy && d.quality === STORY_QUALITY) return node;
  return {
    ...node,
    data: { ...d, quality: STORY_QUALITY, ...(legacy ? { promptText: STORY_PROMPT } : {}) },
  };
}

export function enrichFlowGraphWithProfile(
  rawGraph: FlowGraph,
  profile: CreativeProfileRow | null
): FlowGraph {
  const graph: FlowGraph = { ...rawGraph, nodes: rawGraph.nodes.map((n) => upgradeStoryNode(upgradeReferenceInstructions(n))) };
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
        // Refs que o operador tirou do node não voltam pelo perfil.
        const removed = new Set(node.data.removedUrls ?? []);
        const existing = node.data.referenceUrls ?? [];
        const fromProfile = profile.style_reference_urls ?? [];
        return {
          ...node,
          data: {
            ...node.data,
            referenceUrls:
              fromProfile.length > 0 ? fromProfile.filter((url) => !removed.has(url)) : existing,
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
