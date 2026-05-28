import { z } from "zod";
import { isValidHexColor, normalizeHexColor } from "@/lib/utils/color";

const hexColorSchema = z
  .string()
  .refine((v) => isValidHexColor(v), "Cor inválida. Use formato hex (#RRGGBB)")
  .transform((v) => normalizeHexColor(v)!);

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
  brandColors: z
    .array(hexColorSchema)
    .min(1, "Selecione ao menos 1 cor da identidade visual")
    .max(5, "Máximo de 5 cores"),
  fontStyles: z
    .string()
    .min(3, "Defina os estilos tipográficos da marca"),
  logoUrl: z.string().optional(),
  logoStoragePath: z.string().optional(),
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
