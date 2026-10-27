/**
 * Análise de um estilo de carrossel: a IA (OpenAI) vê todas as artes de
 * exemplo juntas (na ordem do carrossel) e devolve o DNA estruturado.
 *
 * Roda quando o operador pede (botão "Analisar estilo"), não a cada upload:
 * o DNA depende do conjunto, e reanalisar a cada imagem custaria N chamadas.
 */

import { inputImage, inputText, openaiStructured, type OpenAIInputPart } from "@/lib/ai/openai-text";
import { STUDIO_FONTS } from "@/lib/carousel-studio/fonts";
import { styleDnaSchema, type StyleDna } from "./dna";

/** Teto de imagens por análise — um carrossel de exemplo raramente passa de 10. */
export const MAX_STYLE_IMAGES = 12;

const ROLE_LABEL = { cover: "capa", inner: "miolo", cta: "CTA final" } as const;

export type StyleAnalysisImage = {
  url: string;
  role: keyof typeof ROLE_LABEL | null;
};

function systemPrompt(): string {
  const fonts = STUDIO_FONTS.map((f) => `${f.id} (${f.vibe})`).join("; ");
  return `Você é diretor de arte sênior e está catalogando ESTILOS de carrossel de Instagram para uma agência brasileira.

Você recebe as artes de UM carrossel de exemplo, na ordem. Sua tarefa é extrair o DNA do estilo: o sistema visual que faz esses cards serem uma família, de forma que outro designer consiga criar um carrossel NOVO, com outro assunto e outra copy, que pareça claramente do mesmo estilo.

- Descreva o SISTEMA, não o conteúdo: ignore o assunto e os textos específicos das artes.
- Seja concreto e mensurável sempre que der (proporções, posições, tamanhos relativos, pesos).
- Diferencie o que é constante (identidade) do que varia de card para card.
- Fontes: escolha, entre as disponíveis, as mais próximas das usadas. Disponíveis: ${fonts}.
- Escreva em português do Brasil. Nunca use travessão (— ou –).`;
}

function userContent(name: string, description: string | null, images: StyleAnalysisImage[]): OpenAIInputPart[] {
  const blocks: OpenAIInputPart[] = [];
  images.forEach((image, i) => {
    blocks.push(inputText(`Card ${i + 1}${image.role ? ` (${ROLE_LABEL[image.role]})` : ""}:`));
    blocks.push(inputImage(image.url));
  });
  blocks.push({
    type: "input_text",
    text: `Estilo: ${name}${description?.trim() ? `\nNotas do operador: ${description.trim()}` : ""}\n\nExtraia o DNA deste estilo.`,
  });
  return blocks;
}

export async function analyzeCarouselStyle(params: {
  name: string;
  description: string | null;
  images: StyleAnalysisImage[];
}): Promise<StyleDna> {
  const images = params.images.filter((i) => /^https:\/\//.test(i.url)).slice(0, MAX_STYLE_IMAGES);
  if (images.length === 0) throw new Error("Suba ao menos uma arte para analisar o estilo");

  return openaiStructured({
    system: systemPrompt(),
    input: userContent(params.name, params.description, images),
    schemaName: "style_dna",
    schema: styleDnaSchema,
    maxOutputTokens: 16000,
    reasoningEffort: "medium",
    timeoutMs: 120_000,
  });
}
