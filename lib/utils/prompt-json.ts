import type { NanoBananaPromptTemplate } from "@/types";

export type PromptJson = Record<string, unknown>;

export function normalizeTemplatePrompt(
  template: NanoBananaPromptTemplate & { fullPrompt?: string }
): PromptJson {
  if (template.prompt && typeof template.prompt === "object") {
    return template.prompt as PromptJson;
  }

  if (typeof template.fullPrompt === "string") {
    const trimmed = template.fullPrompt.trim();
    if (trimmed.startsWith("{")) {
      try {
        return JSON.parse(trimmed) as PromptJson;
      } catch {
        /* fall through */
      }
    }
    return {
      legacyFormat: "text",
      promptText: template.fullPrompt,
    };
  }

  return {};
}

export function formatPromptJson(
  prompt: PromptJson,
  indent = 2
): string {
  return JSON.stringify(prompt, null, indent);
}
