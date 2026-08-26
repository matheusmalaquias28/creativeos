import { z } from "zod";
import { isUsableClientName } from "@/lib/demands/normalize-client-name";

export const createClientSchema = z.object({
  name: z
    .string()
    .min(2, "Nome do cliente deve ter no mínimo 2 caracteres")
    .max(120, "Nome muito longo")
    .refine((name) => isUsableClientName(name), {
      message: "Use o nome real do cliente — identificadores automáticos não podem ser cadastrados.",
    }),
});

export type CreateClientFormValues = z.infer<typeof createClientSchema>;

/** Briefing enxuto: logo persistida no onboarding_answers. */
export const onboardingSchema = z.object({
  logoUrl: z.string().optional(),
  logoStoragePath: z.string().optional(),
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
