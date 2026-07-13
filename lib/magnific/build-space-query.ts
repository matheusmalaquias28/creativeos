import type { DemandArte } from "@/types/demand";

export type CreativeProfileBrief = {
  basePrompt: string;
  palette: string[];
};

/**
 * Instrução em linguagem natural para `spaces_edit` — não depende de Creative
 * Brain/brand DNA. Só headline/subheadline/CTA de cada arte entram como texto
 * — sem isso explícito, o Magnific tende a inventar textos/informações extras
 * que não vieram da demanda.
 *
 * `spaces_edit` não tem um jeito estruturado de nomear/mencionar um node
 * específico (sem sintaxe de "@" no texto) — a única forma de diferenciar a
 * logo das demais referências é descrevê-la por posição. `hasLogo` assume que
 * a logo é sempre a PRIMEIRA imagem adicionada ao Space (ver generate-space.ts,
 * que monta `imageUrls` com a logo primeiro quando existe).
 */
export function buildMagnificSpaceQuery(
  artes: DemandArte[],
  tipo: string | null,
  profile: CreativeProfileBrief | null,
  hasLogo: boolean
): string {
  const parts: string[] = [];

  parts.push(
    tipo
      ? `Crie um conjunto de artes para "${tipo}" usando as imagens de referência já adicionadas neste Space.`
      : "Crie um conjunto de artes usando as imagens de referência já adicionadas neste Space."
  );

  if (hasLogo) {
    parts.push(
      "A primeira imagem adicionada a este Space é a logo do cliente. Ela DEVE aparecer em cada arte gerada, sempre no canto superior esquerdo, em tamanho pequeno e sem alterações — NÃO a use como referência de estilo, cor ou composição. As demais imagens já adicionadas ao Space (se houver) são referências visuais de estilo/conteúdo, não a logo."
    );
  }

  if (profile?.basePrompt.trim()) {
    parts.push(profile.basePrompt.trim());
  }

  if (profile?.palette.length) {
    parts.push(`Utilize as cores: ${profile.palette.slice(0, 6).join(", ")}.`);
  }

  const textLines: string[] = [];
  artes.forEach((arte, index) => {
    const copyParts: string[] = [];
    if (arte.headline) copyParts.push(`Headline: ${arte.headline}`);
    if (arte.subheadline) copyParts.push(`Subheadline: ${arte.subheadline}`);
    if (arte.cta) copyParts.push(`CTA: ${arte.cta}`);
    if (copyParts.length === 0) return;

    const label = artes.length > 1 ? `Arte ${index + 1}` : "Arte";
    textLines.push(`${label} — ${copyParts.join("  ")}.`);
  });

  if (textLines.length) {
    parts.push(
      [
        "A IMAGEM DE CADA ARTE DEVE CONTER SOMENTE ESSES TEXTOS, NADA MAIS (use em cada arte apenas os textos da linha correspondente):",
        ...textLines,
      ].join("\n")
    );
    parts.push(
      "NÃO adicione nenhum outro texto nas artes além dos listados acima — nada de frases, informações, preços ou datas inventadas."
    );
    if (artes.some((arte) => arte.cta)) {
      parts.push(
        "O CTA é um BOTÃO: em cada arte, renderize o CTA como um botão gráfico, SEMPRE centralizado na parte inferior da imagem."
      );
    }
  } else {
    parts.push("NÃO adicione nenhum texto nas artes.");
  }

  return parts.join(" ");
}
