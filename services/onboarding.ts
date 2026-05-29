import { createClient } from "@/lib/supabase/server";
import type { OnboardingFormValues } from "@/lib/schemas/client";
import { isSchemaMissingError, schemaNotReadyError } from "@/lib/errors/database";
import type { OnboardingAnswers } from "@/types";

function throwIfDbError(error: { message: string }) {
  if (isSchemaMissingError(error.message)) {
    throw schemaNotReadyError(error.message);
  }
  throw new Error(error.message);
}

export async function getOnboardingAnswers(
  clientId: string
): Promise<OnboardingAnswers | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_answers")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) throwIfDbError(error);
  return data;
}

export type ParsedOnboardingAnswers = Partial<OnboardingFormValues>;

export function parseOnboardingAnswers(
  record: OnboardingAnswers | null
): ParsedOnboardingAnswers {
  if (!record?.answers || typeof record.answers !== "object") {
    return { brandColors: [], fontStyles: "" };
  }
  const raw = record.answers as Partial<OnboardingFormValues>;
  return {
    ...raw,
    brandColors: Array.isArray(raw.brandColors) ? raw.brandColors : [],
    fontStyles: raw.fontStyles ?? "",
    logoUrl: raw.logoUrl,
    logoStoragePath: raw.logoStoragePath,
  };
}

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
