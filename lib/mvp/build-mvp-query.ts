import type { MvpPage } from "@/types/mvp";

export type MvpReferenceMention = {
  /** creation identifier retornado pelo creations_upload_image */
  identifier: string;
  label: string;
};

function mention(ref: MvpReferenceMention): string {
  return `@[${ref.identifier}:${ref.label}:output]`;
}

function pageCopy(page: MvpPage): string {
  const lines = page.blocks.map((block) => {
    switch (block.type) {
      case "title":
        return `Título: ${block.text}`;
      case "subtitle":
        return `Subtítulo: ${block.text}`;
      case "bullet":
        return `• ${block.text}`;
      case "quote":
        return `Citação: "${block.text}"`;
      case "cta":
        return `CTA: ${block.text}`;
      default:
        return block.text;
    }
  });
  return lines.join("\n");
}

// O spaces_edit rejeita queries acima de ~4000 caracteres; orçamento com folga
// para o sufixo "NÃO renomeie este Space" adicionado na hora do envio.
const QUERY_CHAR_BUDGET = 3600;

function buildHeader(
  batchPages: MvpPage[],
  isFirstBatch: boolean,
  logoIdentifier: string | null,
  references: MvpReferenceMention[]
): string {
  const parts: string[] = [];

  parts.push(
    isFirstBatch
      ? `Crie ${batchPages.length} nodes de geração de imagem, um para cada página de um e-book em formato A4 vertical (proporção 210x297).`
      : `Adicione mais ${batchPages.length} nodes de geração de imagem a este Space, um para cada página do mesmo e-book em formato A4 vertical (proporção 210x297), seguindo EXATAMENTE a mesma identidade visual dos nodes já existentes.`
  );
  parts.push(
    "Todas as páginas devem seguir a MESMA identidade visual (cores, tipografia, estilo de diagramação) para manter constância visual do início ao fim."
  );

  if (logoIdentifier) {
    parts.push(
      `Conecte a logo @[${logoIdentifier}:Logo:output] em todos os nodes de geração e posicione-a de forma discreta em cada página.`
    );
  }

  if (references.length > 0) {
    parts.push(
      `Conecte estas referências visuais em TODOS os nodes de geração e use-as como direção de estilo: ${references
        .map(mention)
        .join(" ")}.`
    );
  }

  return parts.join(" ");
}

function buildPageSection(page: MvpPage): string {
  return [
    `--- Página ${page.index + 1}: ${page.title} ---`,
    "A IMAGEM DESTA PÁGINA DEVE CONTER SOMENTE ESSES TEXTOS, NADA MAIS:",
    pageCopy(page),
  ].join("\n");
}

/**
 * Instruções para o `spaces_edit` do MVP, no mesmo espírito enxuto do prompt de
 * Space de demanda (ver [[magnific-space-prompt-template]]). Cada página vira um
 * node de geração de imagem, e as referências visuais são GERAIS: todas
 * conectadas em TODOS os nodes (menção `@[id:Label:output]`).
 *
 * O spaces_edit limita a query a ~4000 caracteres, então as páginas são
 * empacotadas em LOTES: cada string retornada é uma edição independente sobre o
 * mesmo Space (a primeira cria, as seguintes adicionam mantendo a identidade).
 * Página cujo texto sozinho estoura o orçamento tem a copy cortada no limite.
 */
export function buildMvpSpaceQueryBatches(
  pages: MvpPage[],
  logoIdentifier: string | null,
  references: MvpReferenceMention[],
  opts: { isContinuation?: boolean } = {}
): string[] {
  const batches: string[] = [];
  let pending = [...pages];
  // Continuação = Space já tem nodes de lotes anteriores; até a primeira query
  // deve dizer "Adicione mais" em vez de "Crie".
  let isFirstBatch = !opts.isContinuation;

  while (pending.length > 0) {
    const batchPages: MvpPage[] = [];
    let sections = "";

    for (const page of pending) {
      const candidatePages = [...batchPages, page];
      const header = buildHeader(candidatePages, isFirstBatch, logoIdentifier, references);
      const section = buildPageSection(page);
      const candidate = sections ? `${sections}\n\n${section}` : section;

      if (batchPages.length > 0 && header.length + candidate.length + 1 > QUERY_CHAR_BUDGET) {
        break;
      }
      batchPages.push(page);
      sections = candidate;
    }

    const header = buildHeader(batchPages, isFirstBatch, logoIdentifier, references);
    // Página sozinha maior que o orçamento: corta a copy para caber.
    if (header.length + sections.length + 1 > QUERY_CHAR_BUDGET) {
      const room = QUERY_CHAR_BUDGET - header.length - 1;
      console.warn(
        `[mvp/build-query] Página ${batchPages[0].index + 1} excede o orçamento do spaces_edit — copy cortada`
      );
      sections = sections.slice(0, Math.max(room, 0));
    }

    batches.push(`${header} ${sections}`);
    pending = pending.slice(batchPages.length);
    isFirstBatch = false;
  }

  return batches;
}
