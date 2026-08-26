import type { DemandArte } from "@/types/demand";
import { IMAGE_GEN_DEFAULTS } from "@/lib/ai/imagegen/defaults";

export type CreativeProfileBrief = {
  basePrompt: string;
  palette: string[];
};

/**
 * Instrução em linguagem natural para `spaces_edit`, seguindo o modelo de
 * prompt validado manualmente no Magnific. Deliberadamente enxuto: NÃO envia
 * tipo da demanda, base_prompt do perfil — o formato/modelo/qualidade dos nodes
 * de imagem são fixos (ver IMAGE_GEN_DEFAULTS) e vão explícitos no prompt para o
 * spaces_edit não inventar 1:1 ou modelos diferentes por arte.
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

  parts.push(
    `OBRIGATÓRIO — TODOS os nodes de geração de imagem devem usar: modelo ${IMAGE_GEN_DEFAULTS.model}, aspect ratio ${IMAGE_GEN_DEFAULTS.aspectRatio} (NUNCA 1:1 ou qualquer outro), resolução ${IMAGE_GEN_DEFAULTS.imageSize}, qualidade ${IMAGE_GEN_DEFAULTS.quality}. Sem exceções.`
  );

  parts.push(
    `FLUXO OBRIGATÓRIO após gerar todos os nodes de imagem: (1) conecte TODOS os nodes de imagem a um único node de Lista; (2) conecte essa Lista como entrada (como lista) a um node de imagem com aspect ratio 9:16, modelo ${IMAGE_GEN_DEFAULTS.model}, resolução ${IMAGE_GEN_DEFAULTS.imageSize}, qualidade ${IMAGE_GEN_DEFAULTS.quality} e prompt exatamente: "Adapte essa arte para o formato 9:16, não adicione nada novo e nem distorça as imagens".`
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

  if (profile?.basePrompt.trim()) {
    parts.push(`Identidade visual do cliente: ${profile.basePrompt.trim()}`);
  }

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
