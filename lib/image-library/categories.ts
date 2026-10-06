/**
 * Categorias de uso de uma imagem do acervo dentro de uma arte — fonte única
 * para a UI (rótulos) e para o prompt do Space (instrução de uso).
 *
 * Isomórfico: importado tanto pelo seletor no client quanto pelo
 * build-space-query no servidor.
 */

export const REFERENCE_CATEGORIES = ["subject", "brand", "style", "environment"] as const;
export type ReferenceCategory = (typeof REFERENCE_CATEGORIES)[number];

/** Máximo de imagens do acervo por arte — segura o prompt do Space dentro do orçamento. */
export const MAX_REFERENCES_PER_ARTE = 3;

type CategoryMeta = {
  label: string;
  short: string;
  /** Nome curto do node na menção `@[id:Nome:output]` — uma palavra, sem espaços. */
  mentionName: string;
  /** Como o spaces_edit deve usar a imagem. Curta: entra uma vez por imagem no prompt. */
  instruction: string;
};

export const CATEGORY_META: Record<ReferenceCategory, CategoryMeta> = {
  subject: {
    label: "Fotos do Sujeito / Produto",
    short: "Sujeito",
    mentionName: "Sujeito",
    instruction:
      "é o sujeito/produto principal: reproduza esta pessoa ou objeto com fidelidade total (rosto, traços, forma, cores e detalhes), sem redesenhar, e coloque em destaque na arte",
  },
  brand: {
    label: "Identidade da Marca",
    short: "Marca",
    mentionName: "Marca",
    instruction:
      "é a identidade da marca: siga fielmente a paleta, a tipografia, os grafismos e o acabamento desta imagem (troque só os textos)",
  },
  style: {
    label: "Inspirações de Estilo",
    short: "Estilo",
    mentionName: "Estilo",
    instruction:
      "é a referência de estilo: replique de perto a composição, o enquadramento, o layout, a iluminação, as cores e o tratamento desta imagem — troque apenas os textos, a logo e o conteúdo pelos desta arte",
  },
  environment: {
    label: "Inspirações de Ambiente",
    short: "Ambiente",
    mentionName: "Ambiente",
    instruction: "é a referência de ambiente: reproduza este cenário, fundo e atmosfera",
  },
};

export function isReferenceCategory(value: unknown): value is ReferenceCategory {
  return typeof value === "string" && (REFERENCE_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Instruções antigas (até 2026-10-06) que já foram coladas no texto de prompts
 * e no `intent` de nodes de referência. A de "Estilo" mandava o modelo NÃO
 * seguir a imagem ("é só inspiração… não copie… elementos literais") — por
 * isso as artes ignoravam a referência. `upgradeLegacyInstructions` troca pelo
 * texto atual, de forma visível no node.
 */
const LEGACY_INSTRUCTIONS: Record<string, ReferenceCategory> = {
  "é o sujeito/produto principal: mantenha a pessoa ou objeto fiel (rosto, forma, detalhes) e use em destaque":
    "subject",
  "é identidade da marca: siga paleta, tipografia, grafismos e acabamento, sem copiar textos": "brand",
  "é só inspiração de estilo (luz, tratamento, composição geral): não copie textos, logos nem elementos literais":
    "style",
  "é inspiração de ambiente: use como referência de cenário, fundo e atmosfera": "environment",
};

export function upgradeLegacyInstructions(text: string): string {
  let out = text;
  for (const [legacy, category] of Object.entries(LEGACY_INSTRUCTIONS)) {
    if (out.includes(legacy)) out = out.split(legacy).join(CATEGORY_META[category].instruction);
  }
  return out;
}
