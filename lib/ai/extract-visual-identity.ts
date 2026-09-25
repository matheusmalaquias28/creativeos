import type Anthropic from "@anthropic-ai/sdk";
import {
  visualIdentityDnaSchema,
  type VisualIdentityDna,
} from "@/lib/schemas/visual-identity";
import { DEFAULT_CLAUDE_MODEL, getAnthropicClient } from "@/lib/ai/client";
import {
  VISUAL_IDENTITY_SYSTEM_PROMPT,
  buildVisualIdentityUserPrompt,
} from "@/lib/ai/prompts/visual-identity";
import { fetchValidatedVisionImage } from "@/lib/utils/vision-image";

const MAX_TOKENS = 2500;

function extractTextContent(
  content: Anthropic.Messages.Message["content"]
): string {
  const textBlock = content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Resposta vazia do Claude");
  }
  return textBlock.text.trim();
}

function parseJsonResponse(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return JSON.parse(fenced[1].trim());
  const bare = trimmed.match(/(\{[\s\S]*\})/);
  if (bare) return JSON.parse(bare[1]);
  return JSON.parse(trimmed);
}

export function buildBasePromptFromDna(dna: VisualIdentityDna): string {
  const typography = [
    `Headlines: ${dna.typography.headlineStyle}`,
    `Corpo: ${dna.typography.bodyStyle}`,
    dna.typography.notes ? `Notas tipográficas: ${dna.typography.notes}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  return [
    dna.summary,
    `Estilo compositivo: ${dna.compositionStyle}.`,
    `Tom/mood: ${dna.mood}.`,
    `Tipografia: ${typography}.`,
    `Elementos recorrentes: ${dna.elementsToRepeat.join(", ")}.`,
    dna.visualKeywords.length
      ? `Palavras-chave visuais: ${dna.visualKeywords.join(", ")}.`
      : null,
    dna.avoid?.length ? `Evitar: ${dna.avoid.join(", ")}.` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function extractVisualIdentityFromImages(
  sampleUrls: string[],
  clientName?: string
): Promise<VisualIdentityDna> {
  const validations = await Promise.all(
    sampleUrls.map((url) => fetchValidatedVisionImage(url, "identity-sample"))
  );
  const validated = validations.filter(
    (v): v is NonNullable<typeof v> => v !== null
  );
  if (validated.length === 0) {
    throw new Error("Nenhuma imagem de referência válida (formato não suportado)");
  }

  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: DEFAULT_CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.2,
    system: VISUAL_IDENTITY_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          ...validated.map((v) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: v.mimeType,
              data: v.base64,
            },
          })),
          {
            type: "text",
            text: buildVisualIdentityUserPrompt(clientName, validated.length),
          },
        ],
      },
    ],
  });

  const parsed = parseJsonResponse(extractTextContent(response.content));
  return visualIdentityDnaSchema.parse(parsed);
}
