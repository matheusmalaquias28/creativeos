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
  // [1] Paleta de cores
  brandColors: z.array(hexColorSchema).max(5, "Máximo de 5 cores").optional(),
  fontStyles: z.string().optional(),
  logoUrl: z.string().optional(),
  logoStoragePath: z.string().optional(),
  // [2] Logo com qualidade?
  logoQualityOk: z.boolean().nullable().optional(),
  // [3] Imagens do cliente?
  hasClientImages: z.boolean().nullable().optional(),
  // [4] Referências (até 5)
  references: z.array(z.string()).max(5).optional(),
  // [5] Site?
  hasSite: z.boolean().nullable().optional(),
  siteUrl: z.string().optional(),
  // [6] Instagram
  instagramHandle: z.string().optional(),
  // [7] Google Meu Negócio?
  hasGMB: z.boolean().nullable().optional(),
  // [8] ID Visual?
  hasVisualIdentity: z.boolean().nullable().optional(),
  visualIdentityOption: z.enum(["sell", "name_only"]).nullable().optional(),
  // Briefing Criativo — todos opcionais
  businessDescription: z.string().optional(),
  targetAudience: z.string().optional(),
  brandPersonality: z.string().optional(),
  competitors: z.string().optional(),
  goals: z.string().optional(),
  toneOfVoice: z.string().optional(),
  visualInspirations: z.string().optional(),
  avoidStyles: z.string().optional(),
});


export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
