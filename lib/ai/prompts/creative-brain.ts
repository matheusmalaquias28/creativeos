import type { OnboardingFormValues } from "@/lib/schemas/client";

export const CREATIVE_BRAIN_SYSTEM_PROMPT = `You are a senior brand strategist for a performance marketing agency.
Generate a structured Brand DNA (Creative Brain) from client onboarding data.
Respond ONLY with valid JSON matching the exact schema provided — no markdown, no code fences, no commentary.
Be specific, actionable, and visually oriented. Language: Portuguese (Brazil).`;

export function buildCreativeBrainUserPrompt(
  onboarding: Partial<OnboardingFormValues>,
  referenceCount: number
): string {
  return JSON.stringify({
    onboarding,
    referenceCount,
    outputSchema: {
      brandStyle: "string",
      visualDirection: "string",
      audienceProfile: "string",
      preferredColors: ["string"],
      compositionPreferences: ["string"],
      negativeStyles: ["string"],
      recommendedHooks: ["string"],
      visualKeywords: ["string"],
    },
  });
}
