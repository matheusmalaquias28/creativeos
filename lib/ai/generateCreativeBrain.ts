import type Anthropic from "@anthropic-ai/sdk";
import { brandDnaSchema, type BrandDnaInput } from "@/lib/schemas/creative-brain";
import type { OnboardingFormValues } from "@/lib/schemas/client";
import { DEFAULT_CLAUDE_MODEL, getAnthropicClient } from "@/lib/ai/client";
import {
  CREATIVE_BRAIN_SYSTEM_PROMPT,
  buildCreativeBrainUserPrompt,
} from "@/lib/ai/prompts/creative-brain";

const MAX_RETRIES = 3;
const MAX_TOKENS = 4096;

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
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const jsonString = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(jsonString);
}

export async function generateCreativeBrain(
  onboarding: Partial<OnboardingFormValues>,
  referenceCount = 0
): Promise<BrandDnaInput> {
  const anthropic = getAnthropicClient();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: DEFAULT_CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
        system: CREATIVE_BRAIN_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildCreativeBrainUserPrompt(onboarding, referenceCount),
          },
        ],
      });

      const raw = extractTextContent(response.content);
      const parsed = brandDnaSchema.safeParse(parseJsonResponse(raw));

      if (!parsed.success) {
        throw new Error(
          `Invalid Brand DNA structure: ${parsed.error.message}`
        );
      }

      return parsed.data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, attempt * 500));
      }
    }
  }

  throw lastError ?? new Error("Failed to generate Creative Brain");
}
