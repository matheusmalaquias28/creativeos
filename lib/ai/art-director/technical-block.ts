/**
 * Bloco técnico determinístico anexado ao prompt aprovado.
 *
 * Divisão de responsabilidade: a IA decide a cena, isto impõe as regras de
 * negócio que não são negociáveis (lista fechada de textos, CTA como botão,
 * ordem enumerada das referências, formato). Testável e sem chamada de modelo.
 *
 * A ordem enumerada aqui DEVE bater com a ordem das InlineDataParts montadas no
 * worker — ambas derivam da mesma lista de `art_job_reference` ordenada por
 * `position`, que é o que torna isso confiável e não uma convenção espelhada.
 */

import type { ReferenceRole } from "./types";

export type TechnicalBlockRef = {
  role: ReferenceRole;
  intent: string | null;
};

export type TechnicalBlockSpec = {
  headline?: string | null;
  subheadline?: string | null;
  cta?: string | null;
  informacoesExtras?: string | null;
  aspectRatio?: string | null;
  imageSize?: string | null;
};

function roleSentence(ref: TechnicalBlockRef): string {
  if (ref.role === "logo") {
    return "é a logo da marca — não a use como referência de estilo, cor ou composição.";
  }
  const intent = ref.intent?.trim();
  return intent || `use como referência de ${ref.role}.`;
}

export function buildReferenceBlock(refs: TechnicalBlockRef[]): string {
  if (refs.length === 0) return "";

  const lines = refs.map((ref, i) => `- Imagem ${i + 1}: ${roleSentence(ref)}`);
  return ["As imagens de referência fornecidas, na ordem:", ...lines].join("\n");
}

/**
 * Exigência de cena. Vai junto do bloco de texto porque é a contrapartida dele:
 * sem isso, a restrição de texto abaixo é lida como restrição da arte inteira.
 */
export const SCENE_REQUIREMENT =
  "A arte tem IMAGEM: a cena descrita acima ocupa o quadro inteiro, com " +
  "profundidade e ponto focal. Fundo liso, gradiente vazio ou composição apenas " +
  "com tipografia e logo é entrega errada. O texto pousa SOBRE a cena, em área " +
  "preparada para ele (respiro, desfoque ou sobreposição escura).";

export function buildTextBlock(spec: TechnicalBlockSpec): string {
  const lines: string[] = [];
  if (spec.headline) lines.push(`- Headline principal: "${spec.headline}"`);
  if (spec.subheadline) lines.push(`- Subheadline: "${spec.subheadline}"`);
  if (spec.cta) lines.push(`- Call-to-action: "${spec.cta}"`);
  if (spec.informacoesExtras) {
    lines.push(`- Informações adicionais: ${spec.informacoesExtras}`);
  }

  if (lines.length === 0) {
    return "Nenhum TEXTO deve aparecer na arte. A cena visual continua obrigatória.";
  }

  // A frase antiga ("A IMAGEM DEVE CONTER SOMENTE ESSES TEXTOS, NADA MAIS")
  // era lida ao pé da letra: o modelo entregava tipografia e logo sobre fundo
  // liso. A restrição é de TEXTO, e precisa dizer isso explicitamente.
  const parts = [
    ["TEXTO PERMITIDO NA ARTE — estes e somente estes:", ...lines].join("\n"),
    "Nenhum outro TEXTO pode aparecer: nada de frases, preços, datas, selos, " +
      "marca d'água, endereço ou informação inventada. Esta restrição vale " +
      "SOMENTE para texto — os elementos visuais da cena continuam obrigatórios.",
  ];

  if (spec.cta) {
    parts.push(
      "O call-to-action (CTA) é um BOTÃO: renderize-o como um botão gráfico, SEMPRE centralizado na parte inferior da imagem."
    );
  }

  return parts.join("\n\n");
}

/**
 * Concatena o prompt escrito (ou editado pelo operador) com o bloco técnico.
 * O prompt aprovado vem primeiro: é o que carrega a direção.
 */
export function appendTechnicalBlock(
  approvedPrompt: string,
  spec: TechnicalBlockSpec,
  refs: TechnicalBlockRef[]
): string {
  const parts: string[] = [approvedPrompt.trim()];

  const refBlock = buildReferenceBlock(refs);
  if (refBlock) parts.push(refBlock);

  parts.push(SCENE_REQUIREMENT);
  parts.push(buildTextBlock(spec));

  const tech: string[] = [];
  if (spec.aspectRatio) tech.push(`proporção ${spec.aspectRatio}`);
  if (spec.imageSize) tech.push(`resolução ${spec.imageSize}`);
  if (tech.length) {
    parts.push(`Produção para redes sociais, ${tech.join(", ")}.`);
  }

  return parts.filter(Boolean).join("\n\n");
}
