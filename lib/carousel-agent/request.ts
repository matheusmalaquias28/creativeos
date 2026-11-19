import { z } from "zod";
import { MAX_SCHEDULE_AHEAD_MS } from "@/lib/instagram/schedule";
import { AGENT_MAX_CARDS, AGENT_MIN_CARDS } from "./types";

/** Corpo do `POST /api/carousel-agent/runs` (contrato com o agente). */
export const createRunSchema = z
  .object({
    profileId: z.string().uuid().optional(),
    instagram: z.string().trim().min(1).max(60).optional(),
    content: z.string().trim().min(3).max(20_000),
    /** carousel (padrão): cards em imagem · single: arte única · tweet: carrossel "print de tweet". */
    format: z.enum(["carousel", "single", "tweet"]).default("carousel"),
    mode: z.enum(["ai", "manual"]).default("ai"),
    /** Só no tweet: fundo claro (padrão) ou escuro. */
    theme: z.enum(["light", "dark"]).optional(),
    cardCount: z.number().int().min(AGENT_MIN_CARDS).max(AGENT_MAX_CARDS).optional(),
    scheduledAt: z.string().datetime({ offset: true }).optional(),
    externalRef: z.string().trim().max(200).optional(),
    callbackUrl: z.string().url().startsWith("https://").max(500).optional(),
  })
  .refine((b) => b.profileId || b.instagram, { message: "Informe profileId ou instagram (o @ do perfil)" });

export type CreateRunBody = z.infer<typeof createRunSchema>;

/** Horário pedido pelo agente: no futuro e até 75 dias. Devolve o erro ou null. */
export function scheduledAtProblem(iso: string, now = Date.now()): string | null {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "scheduledAt inválido";
  if (at <= now) return "scheduledAt precisa estar no futuro";
  if (at > now + MAX_SCHEDULE_AHEAD_MS) return "scheduledAt pode ser no máximo 75 dias à frente";
  return null;
}

export function zodMessage(error: z.ZodError): string {
  return error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
}
