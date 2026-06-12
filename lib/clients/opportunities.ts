import type { OnboardingFormValues } from "@/lib/schemas/client";
import { isNegativeOpportunity } from "@/lib/utils/parse-stored-boolean";

export type ClientOpportunityId =
  | "logo_vectorization"
  | "ai_photoshoot"
  | "landing_page"
  | "google_business";

export const CLIENT_OPPORTUNITY_LABELS: Record<ClientOpportunityId, string> = {
  logo_vectorization: "Vetorização de logo",
  ai_photoshoot: "Ensaio de IA",
  landing_page: "LP ou Site Institucional",
  google_business: "Google Meu Negócio",
};

const OPPORTUNITY_FIELDS: {
  id: ClientOpportunityId;
  field: keyof OnboardingFormValues;
}[] = [
  { id: "logo_vectorization", field: "logoQualityOk" },
  { id: "ai_photoshoot", field: "hasClientImages" },
  { id: "landing_page", field: "hasSite" },
  { id: "google_business", field: "hasGMB" },
];

export function getClientOpportunityFlags(
  answers: Partial<OnboardingFormValues>
): ClientOpportunityId[] {
  return OPPORTUNITY_FIELDS.filter(({ field }) =>
    isNegativeOpportunity(answers[field])
  ).map(({ id }) => id);
}
