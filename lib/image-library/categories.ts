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
      "é o sujeito/produto principal: mantenha a pessoa ou objeto fiel (rosto, forma, detalhes) e use em destaque",
  },
  brand: {
    label: "Identidade da Marca",
    short: "Marca",
    mentionName: "Marca",
    instruction:
      "é identidade da marca: siga paleta, tipografia, grafismos e acabamento, sem copiar textos",
  },
  style: {
    label: "Inspirações de Estilo",
    short: "Estilo",
    mentionName: "Estilo",
    instruction:
      "é só inspiração de estilo (luz, tratamento, composição geral): não copie textos, logos nem elementos literais",
  },
  environment: {
    label: "Inspirações de Ambiente",
    short: "Ambiente",
    mentionName: "Ambiente",
    instruction: "é inspiração de ambiente: use como referência de cenário, fundo e atmosfera",
  },
};

export function isReferenceCategory(value: unknown): value is ReferenceCategory {
  return typeof value === "string" && (REFERENCE_CATEGORIES as readonly string[]).includes(value);
}
