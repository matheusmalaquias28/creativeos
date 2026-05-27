import { z } from "zod";

export const createClientSchema = z.object({
  name: z
    .string()
    .min(2, "Nome do cliente deve ter no mínimo 2 caracteres")
    .max(120, "Nome muito longo"),
});

export type CreateClientFormValues = z.infer<typeof createClientSchema>;

export const onboardingSchema = z.object({
  businessDescription: z.string().min(10, "Descreva o negócio com mais detalhes"),
  targetAudience: z.string().min(5, "Descreva o público-alvo"),
  brandPersonality: z.string().min(3, "Descreva a personalidade da marca"),
  competitors: z.string().optional(),
  goals: z.string().min(5, "Descreva os objetivos da campanha"),
  toneOfVoice: z.string().min(3, "Defina o tom de voz"),
  visualInspirations: z.string().optional(),
  avoidStyles: z.string().optional(),
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
