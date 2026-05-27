import Anthropic from "@anthropic-ai/sdk";

let anthropicClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/** Modelo padrão — equivalente leve/rápido ao uso anterior com mini */
export const DEFAULT_CLAUDE_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
