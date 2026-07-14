import type { DemandArte } from "@/types/demand";

export type CreativeProfileBrief = {
  basePrompt: string;
  palette: string[];
};

/**
 * Instrução em linguagem natural para `spaces_edit`, seguindo o modelo de
 * prompt validado manualmente no Magnific. Deliberadamente enxuto: NÃO envia
 * tipo da demanda, base_prompt do perfil nem formato/proporção da imagem — o
 * formato é configuração do node de imagem, não do prompt, e parâmetros extras
 * atrapalham mais do que ajudam. O que varia por cliente são só as cores.
 *
 * `logoIdentifier` é o creation identifier retornado pelo upload da logo —
 * a menção `@[id:Logo:output]` é como o spaces_edit referencia um node
 * específico do Space.
 */
export function buildMagnificSpaceQuery(
  artes: DemandArte[],
  profile: CreativeProfileBrief | null,
  logoIdentifier: string | null
): string {
  const parts: string[] = [];

  parts.push(
    artes.length > 1
      ? `Desenvolva ${artes.length} artes para as redes sociais,`
      : "Desenvolva uma arte para as redes sociais,"
  );

  if (logoIdentifier) {
    parts.push(
      `use a logo @[${logoIdentifier}:Logo:output] no canto superior esquerdo, em pequeno tamanho.`
    );
  } else {
    // Sem identifier não há como mencionar o node — cai na descrição por posição.
    parts.push("use a logo (a primeira imagem deste Space) no canto superior esquerdo, em pequeno tamanho.");
  }

  parts.push("Adicione uma imagem em destaque condizente com o tema da arte.");

  if (profile?.palette.length) {
    parts.push(`Use as cores ${profile.palette.slice(0, 6).join(" e ")}.`);
  }

  if (artes.some((arte) => arte.cta)) {
    parts.push("A CTA deve ficar centralizada na parte inferior da imagem.");
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
      ["Utilize somente esses textos na criação da arte:", ...textLines].join("\n")
    );
  }

  return parts.join(" ");
}
