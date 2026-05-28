import type Anthropic from "@anthropic-ai/sdk";
import { brandDnaSchema, type BrandDnaInput } from "@/lib/schemas/creative-brain";
import type { OnboardingFormValues } from "@/lib/schemas/client";
import type { ClientReference } from "@/types";
import { DEFAULT_CLAUDE_MODEL, getAnthropicClient } from "@/lib/ai/client";
import { buildClaudeReferenceImageBlocks } from "@/lib/ai/reference-media";
import {
  CREATIVE_BRAIN_SYSTEM_PROMPT,
  buildCreativeBrainUserPrompt,
} from "@/lib/ai/prompts/creative-brain";
import { isImageProcessingError } from "@/lib/utils/vision-image";

const MAX_RETRIES = 2;
const MAX_TOKENS = 5000;

function extractTextContent(
  content: Anthropic.Messages.Message["content"]
): string {
  const textBlock = content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Empty response from Claude");
  }
  return textBlock.text.trim();
}

function parseJsonResponse(raw: string): unknown {
  const trimmed = raw.trim();
  // Extract from fenced block anywhere in the response (Claude may add preamble text)
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return JSON.parse(fenced[1].trim());
  // Extract bare JSON object or array if present
  const bare = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (bare) return JSON.parse(bare[1]);
  return JSON.parse(trimmed);
}

/**
 * Se o Claude retornar o Brand DNA dentro de um wrapper (ex: { brandDna: {...} }),
 * desempacota o objeto filho único antes de validar com o schema.
 */
function unwrapIfNeeded(parsed: unknown): unknown {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return parsed;
  }
  const keys = Object.keys(parsed as object);
  if (keys.length === 1) {
    const child = (parsed as Record<string, unknown>)[keys[0]];
    if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      return child;
    }
  }
  return parsed;
}

function buildUserContent(
  userText: string,
  imageBlocks: Anthropic.Messages.ImageBlockParam[],
  labels: string[]
): Anthropic.Messages.MessageParam["content"] {
  if (imageBlocks.length === 0) return userText;

  return [
    ...imageBlocks,
    {
      type: "text",
      text: `Refs (${labels.length}): ${labels.join(", ")}\n${userText}`,
    },
  ];
}

async function callClaude(
  userContent: Anthropic.Messages.MessageParam["content"]
): Promise<string> {
  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: DEFAULT_CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.4,
    system: CREATIVE_BRAIN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });
  return extractTextContent(response.content);
}

export async function generateCreativeBrain(
  onboarding: Partial<OnboardingFormValues>,
  references: ClientReference[] = [],
  clientName?: string
): Promise<BrandDnaInput> {
  const { blocks: imageBlocks, labels, skipped } =
    await buildClaudeReferenceImageBlocks(references, onboarding.logoUrl);

  const userText = buildCreativeBrainUserPrompt(
    onboarding,
    references,
    labels,
    clientName,
    skipped
  );

  let lastError: Error | null = null;
  let useImages = imageBlocks.length > 0;
  let retriedWithoutImages = false;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const content = buildUserContent(
        userText,
        useImages ? imageBlocks : [],
        useImages ? labels : []
      );
      const raw = await callClaude(content);
      const parsed = brandDnaSchema.safeParse(unwrapIfNeeded(parseJsonResponse(raw)));

      if (!parsed.success) {
        throw new Error(`Invalid Brand DNA structure: ${parsed.error.message}`);
      }

      return parsed.data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (useImages && isImageProcessingError(error) && !retriedWithoutImages) {
        console.warn(
          "[generateCreativeBrain] Claude rejected images — retrying text-only. Skipped:",
          skipped
        );
        useImages = false;
        retriedWithoutImages = true;
        continue;
      }

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  throw lastError ?? new Error("Failed to generate Creative Brain");
}
