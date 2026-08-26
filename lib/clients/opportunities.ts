import type { OnboardingFormValues } from "@/lib/schemas/client";

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

/** Briefing enxuto — oportunidades comerciais desativadas nesta versão. */
export function getClientOpportunityFlags(
  _answers: Partial<OnboardingFormValues>
): ClientOpportunityId[] {
  return [];
}
