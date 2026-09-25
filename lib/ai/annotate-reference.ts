/**
 * Anotação por IA de visão de uma referência do acervo.
 *
 * Roda uma vez, no upload. É o que permite ao diretor de arte escolher
 * referência lendo ~800 tokens de catálogo em vez de receber 40 imagens em toda
 * chamada — e é o que torna o histórico de uso comparável entre itens.
 *
 * Haiku é o modelo certo aqui: a tarefa é descrição, não julgamento.
 */

import { DEFAULT_CLAUDE_MODEL, getAnthropicClient } from "@/lib/ai/client";
import { fetchValidatedVisionImage } from "@/lib/utils/vision-image";
import { isValidHexColor, normalizeHexColor } from "@/lib/utils/color";
import { isReferenceKind, type ReferenceKind } from "@/lib/ai/art-director/types";
import {
  REFERENCE_ANNOTATION_SYSTEM_PROMPT,
  REFERENCE_ANNOTATION_USER_PROMPT,
} from "@/lib/ai/prompts/reference-annotation";

export type ReferenceAnnotation = {
  description: string;
  tags: string[];
  colors: string[];
  kind: ReferenceKind;
};

const MAX_TOKENS = 500;

function parseJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return JSON.parse(fenced[1].trim());
  const bare = trimmed.match(/\{[\s\S]*\}/);
  if (bare) return JSON.parse(bare[0]);
  return JSON.parse(trimmed);
}

/**
 * Normaliza em vez de rejeitar: uma tag fora do formato não deve custar a
 * anotação inteira — o catálogo tolera campos parciais, mas não tolera um
 * asset sem descrição nenhuma.
 */
export function normalizeAnnotation(
  parsed: unknown,
  fallbackKind: ReferenceKind
): ReferenceAnnotation {
  const record = (parsed ?? {}) as Record<string, unknown>;

  const description = typeof record.description === "string" ? record.description.trim() : "";
  if (!description) throw new Error("Anotação sem descrição");

  const tags = Array.isArray(record.tags)
    ? record.tags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase().slice(0, 24))
        .filter(Boolean)
        .slice(0, 6)
    : [];

  const colors = Array.isArray(record.colors)
    ? record.colors
        .filter((c): c is string => typeof c === "string" && isValidHexColor(c))
        .map((c) => normalizeHexColor(c)!)
        .slice(0, 5)
    : [];

  const rawKind = typeof record.kind === "string" ? record.kind.trim().toLowerCase() : "";
  const kind = isReferenceKind(rawKind) ? rawKind : fallbackKind;

  return { description: description.slice(0, 200), tags, colors, kind };
}

export async function annotateReference(
  imageUrl: string,
  fallbackKind: ReferenceKind = "estilo"
): Promise<ReferenceAnnotation> {
  const image = await fetchValidatedVisionImage(imageUrl, "reference-asset");
  if (!image) {
    throw new Error("Não foi possível ler a imagem (formato não suportado ou muito grande)");
  }

  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: DEFAULT_CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.2,
    system: REFERENCE_ANNOTATION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: image.mimeType, data: image.base64 },
          },
          { type: "text", text: REFERENCE_ANNOTATION_USER_PROMPT },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Resposta vazia do Claude na anotação");
  }

  return normalizeAnnotation(parseJson(textBlock.text), fallbackKind);
}
