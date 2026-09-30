/**
 * Anotação por IA de visão de uma imagem do acervo global.
 *
 * Diferente de lib/ai/annotate-reference.ts (que descreve só o que é
 * reaproveitável visualmente e esconde o assunto), aqui o ASSUNTO é o ponto:
 * a anotação existe para o operador achar a imagem buscando "balança",
 * "escritório", "advogada" — então descreve o que está na foto.
 *
 * Roda uma vez, no upload.
 */

import { DEFAULT_CLAUDE_MODEL, getAnthropicClient } from "@/lib/ai/client";
import { fetchValidatedVisionImage } from "@/lib/utils/vision-image";
import { isReferenceCategory, type ReferenceCategory } from "./categories";

export type LibraryAnnotation = {
  description: string;
  tags: string[];
  suggestedCategory: ReferenceCategory | null;
};

const MAX_TOKENS = 400;

const SYSTEM_PROMPT = `Você anota imagens de um acervo que um designer usa para montar artes de redes sociais (a maioria para escritórios de advocacia). O designer encontra as imagens BUSCANDO POR TEXTO, então sua anotação precisa conter as palavras que ele digitaria.

Saída: JSON puro, sem cercas de markdown, sem explicação.

{
  "description": "1 a 2 frases em PT-BR, máx. 30 palavras: o que aparece (pessoas, objetos, lugar) e o clima visual (luz, cores)",
  "tags": ["5 a 10 tags em PT-BR, minúsculas, 1-2 palavras cada: assunto, objetos, tipo de pessoa, lugar, cores, estilo"],
  "category": "subject | brand | style | environment"
}

Sobre "category", escolha como a imagem mais provavelmente será usada:
- subject: foto de uma pessoa ou produto que pode ser o protagonista da arte
- brand: peça de identidade visual (logo, paleta, papelaria, grafismos)
- style: arte/post pronto cujo tratamento visual serve de inspiração
- environment: cenário, ambiente ou fundo (escritório, biblioteca, fórum, textura)

Não transcreva textos legíveis nem nomes de marca. Primeiro caractere { e último caractere }.`;

const USER_PROMPT = "Anote esta imagem para o acervo. Responda apenas com o JSON.";

function parseJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return JSON.parse(fenced[1].trim());
  const bare = trimmed.match(/\{[\s\S]*\}/);
  if (bare) return JSON.parse(bare[0]);
  return JSON.parse(trimmed);
}

export function normalizeLibraryAnnotation(parsed: unknown): LibraryAnnotation {
  const record = (parsed ?? {}) as Record<string, unknown>;

  const description = typeof record.description === "string" ? record.description.trim() : "";
  if (!description) throw new Error("Anotação sem descrição");

  const tags = Array.isArray(record.tags)
    ? Array.from(
        new Set(
          record.tags
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.trim().toLowerCase().slice(0, 32))
            .filter(Boolean)
        )
      ).slice(0, 10)
    : [];

  const rawCategory = typeof record.category === "string" ? record.category.trim().toLowerCase() : "";

  return {
    description: description.slice(0, 240),
    tags,
    suggestedCategory: isReferenceCategory(rawCategory) ? rawCategory : null,
  };
}

export async function annotateLibraryImage(imageUrl: string): Promise<LibraryAnnotation> {
  const image = await fetchValidatedVisionImage(imageUrl, "image-library");
  if (!image) {
    throw new Error("Não foi possível ler a imagem (formato não suportado ou muito grande)");
  }

  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: DEFAULT_CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: image.mimeType, data: image.base64 },
          },
          { type: "text", text: USER_PROMPT },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Resposta vazia do Claude na anotação");
  }

  return normalizeLibraryAnnotation(parseJson(textBlock.text));
}
