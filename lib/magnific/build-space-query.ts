import type { DemandArte } from "@/types/demand";
import { IMAGE_GEN_DEFAULTS } from "@/lib/ai/imagegen/defaults";

export type CreativeProfileBrief = {
  basePrompt: string;
  palette: string[];
};

// O spaces_edit rejeita queries acima de ~4000 caracteres; orçamento com folga
// para o sufixo "NÃO renomeie este Space" adicionado na hora do envio (ver
// mesmo padrão em lib/mvp/build-mvp-query.ts). O basePrompt do DNA do cliente é
// a parte de tamanho variável — é ela que é cortada quando o texto fixo já
// preenche boa parte do orçamento.
const QUERY_CHAR_BUDGET = 3600;

/**
 * Instrução em linguagem natural para `spaces_edit`, seguindo o modelo de
 * prompt validado manualmente no Magnific. Deliberadamente enxuto: NÃO envia
 * tipo da demanda — o formato/modelo/qualidade dos nodes de imagem são fixos
 * (ver IMAGE_GEN_DEFAULTS) e vão explícitos no prompt para o spaces_edit não
 * inventar 1:1 ou modelos diferentes por arte.
 *
 * O DNA visual do cliente (`profile.basePrompt`) entra só como um resumo curto
 * de apoio — cores, tipografia e mood, NUNCA para ser copiado como layout. A
 * arte de referência de onde ele foi extraído também é enviada como imagem
 * anexa ao Space (ver `styleUrls` em generate-space.ts), então o prompt deixa
 * explícito que essa imagem é só inspiração de cor/acabamento — sem isso o
 * spaces_edit tende a replicar a composição literal da referência (ex: uma
 * arte de style guide vira grade de swatches com códigos hex na arte final,
 * em vez de conteúdo da demanda). O resumo é cortado no fim da função para
 * nunca estourar o orçamento de caracteres do spaces_edit.
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
    parts.push(
      "Entre as imagens anexadas a este Space está a amostra de identidade visual do cliente — use-a SOMENTE como inspiração de paleta de cores, tratamento tipográfico e acabamento. NÃO replique a composição, a grade, os textos ou os códigos de cor dessa imagem de referência na arte final — a arte final deve seguir o tema e os textos desta demanda."
    );
  }

  // Posição reservada para o resumo do DNA do cliente — preenchida por último,
  // depois de medir quanto orçamento de caracteres sobrou (ver fim da função).
  const identityIndex = parts.length;
  if (profile?.basePrompt.trim()) parts.push("");

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

  if (profile?.basePrompt.trim()) {
    const withoutIdentity = parts.filter((_, i) => i !== identityIndex).join(" ");
    const prefix =
      "Direcionamento de estilo do cliente — use apenas para orientar cor, tipografia e mood, NUNCA como layout a copiar: ";
    const room = QUERY_CHAR_BUDGET - withoutIdentity.length - prefix.length;
    if (room > 20) {
      parts[identityIndex] = `${prefix}${profile.basePrompt.trim().slice(0, room)}`;
    } else {
      parts.splice(identityIndex, 1);
    }
  }

  return parts.join(" ");
}
