import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingFormValues } from "@/lib/schemas/client";
import { isSchemaMissingError, schemaNotReadyError } from "@/lib/errors/database";
import type { OnboardingAnswers } from "@/types";
import type { ClientVisualIdentityState } from "@/lib/schemas/visual-identity";
import {
  getClientVisualIdentity,
  isVisualIdentityReady,
} from "@/services/visual-identity";

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
    return {};
  }
  const raw = record.answers as Partial<OnboardingFormValues>;
  return {
    logoUrl: raw.logoUrl,
    logoStoragePath: raw.logoStoragePath,
  };
}

/** Briefing completo quando o DNA visual foi extraído da amostra de identidade. */
export async function isClientBriefingComplete(clientId: string): Promise<boolean> {
  const visualIdentity = await getClientVisualIdentity(clientId);
  return isVisualIdentityReady(visualIdentity);
}

/** @deprecated Use isClientBriefingComplete(clientId) — mantido para compatibilidade síncrona. */
export function isOnboardingComplete(
  _answers: Partial<OnboardingFormValues>,
  visualIdentity?: ClientVisualIdentityState
): boolean {
  if (visualIdentity) return isVisualIdentityReady(visualIdentity);
  return false;
}
