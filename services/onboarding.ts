import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingFormValues } from "@/lib/schemas/client";
import { isSchemaMissingError, schemaNotReadyError } from "@/lib/errors/database";
import { parseStoredBoolean } from "@/lib/utils/parse-stored-boolean";
import type { OnboardingAnswers } from "@/types";

const ONBOARDING_BOOLEAN_FIELDS = [
  "logoQualityOk",
  "hasClientImages",
  "hasSite",
  "hasGMB",
  "hasVisualIdentity",
] as const satisfies readonly (keyof OnboardingFormValues)[];

function normalizeOnboardingBooleans(
  answers: Partial<OnboardingFormValues>
): Partial<OnboardingFormValues> {
  const normalized = { ...answers };

  for (const field of ONBOARDING_BOOLEAN_FIELDS) {
    if (field in answers) {
      normalized[field] = parseStoredBoolean(answers[field]) as never;
    }
  }

  return normalized;
}

function throwIfDbError(error: { message: string }) {
  if (isSchemaMissingError(error.message)) {
    throw schemaNotReadyError(error.message);
  }
  throw new Error(error.message);
}

export const getOnboardingAnswers = cache(async (
  clientId: string
): Promise<OnboardingAnswers | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_answers")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) throwIfDbError(error);
  return data;
});

export type ParsedOnboardingAnswers = Partial<OnboardingFormValues>;

export function parseOnboardingAnswers(
  record: OnboardingAnswers | null
): ParsedOnboardingAnswers {
  if (!record?.answers || typeof record.answers !== "object") {
    return { brandColors: [], fontStyles: "" };
  }
  const raw = record.answers as Partial<OnboardingFormValues>;
  return normalizeOnboardingBooleans({
    ...raw,
    brandColors: Array.isArray(raw.brandColors) ? raw.brandColors : [],
    fontStyles: raw.fontStyles ?? "",
    logoUrl: raw.logoUrl,
    logoStoragePath: raw.logoStoragePath,
    references: Array.isArray(raw.references) ? raw.references : [],
  });
}

export { normalizeOnboardingBooleans };

export function isOnboardingComplete(
  answers: Partial<OnboardingFormValues>
): boolean {
  const requiredStrings: (keyof OnboardingFormValues)[] = [
    "businessDescription",
    "targetAudience",
    "brandPersonality",
    "goals",
    "toneOfVoice",
    "fontStyles",
  ];

  const stringsOk = requiredStrings.every((key) => {
    const v = answers[key];
    return typeof v === "string" && v.trim().length > 0;
  });

  const colorsOk =
    Array.isArray(answers.brandColors) &&
    answers.brandColors.length >= 1 &&
    answers.brandColors.length <= 5;

  return stringsOk && colorsOk;
}
