import { z } from "zod";
import { MAX_SCHEDULE_AHEAD_MS } from "@/lib/instagram/schedule";
import { AGENT_MAX_CARDS, AGENT_MIN_CARDS, type AgentRunMode, type AgentRunOptions } from "./types";

/** Card pronto mandado pelo agente: texto exato e, opcional, a direção visual dele. */
const requestCardSchema = z.object({
  text: z.string().trim().min(1).max(3000),
  visual: z.string().trim().max(2000).optional(),
});

/** Corpo do `POST /api/carousel-agent/runs` (contrato com o agente). */
export const createRunSchema = z
  .object({
    profileId: z.string().uuid().optional(),
    instagram: z.string().trim().min(1).max(60).optional(),
    /** Tema ou texto pronto. Opcional quando vier `cards` (aí vira contexto da legenda). */
    content: z.string().trim().min(3).max(20_000).optional(),
    /** Cards prontos, na ordem: o texto não é reescrito e o `visual` é usado ao pé da letra. */
    cards: z.array(requestCardSchema).min(1).max(AGENT_MAX_CARDS).optional(),
    /** Direção de arte do pedido inteiro (fundo, foto ou não, estilo, o que evitar). */
    visualDirection: z.string().trim().max(4000).optional(),
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
  .refine((b) => b.profileId || b.instagram, { message: "Informe profileId ou instagram (o @ do perfil)" })
  .refine((b) => b.content || b.cards?.length, { message: "Informe content ou cards", path: ["content"] })
  .refine((b) => !b.cards || b.format !== "single" || b.cards.length === 1, {
    message: "Arte única (single) leva exatamente 1 card",
    path: ["cards"],
  })
  .refine((b) => !b.cards || b.format === "single" || b.cards.length >= AGENT_MIN_CARDS, {
    message: `Carrossel precisa de pelo menos ${AGENT_MIN_CARDS} cards`,
    path: ["cards"],
  });

export type CreateRunBody = z.infer<typeof createRunSchema>;

/**
 * Traduz o pedido para o que fica gravado no carrossel. Com `cards`, o pedido
 * vira modo manual com 1 card por item (o texto não é reescrito); o `content`,
 * se vier junto, entra só como contexto para a legenda.
 */
export function runFieldsFromBody(body: CreateRunBody): {
  mode: AgentRunMode;
  input: string;
  cardCount: number | null;
  options: AgentRunOptions;
} {
  const isTweet = body.format === "tweet";
  const options: AgentRunOptions = isTweet
    ? { theme: body.theme ?? "light" }
    : { visualDirection: body.visualDirection?.trim() || null };

  if (body.cards?.length) {
    const blocks = body.cards.map((c, i) => `Card ${i + 1}:\n${c.text.trim()}`).join("\n\n");
    const context = body.content?.trim();
    if (!isTweet && body.cards.some((c) => c.visual?.trim())) {
      options.cardVisuals = body.cards.map((c) => c.visual?.trim() || null);
    }
    return {
      mode: "manual",
      input: context ? `${blocks}\n\nContexto do pedido (só para a legenda, não vira card):\n${context}` : blocks,
      cardCount: body.format === "single" ? 1 : body.cards.length,
      options,
    };
  }

  return {
    mode: body.mode,
    input: body.content ?? "",
    cardCount: body.format === "single" ? 1 : body.cardCount ?? null,
    options,
  };
}

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
