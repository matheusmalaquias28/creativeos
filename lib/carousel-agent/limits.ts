/**
 * Freios de gasto do Agente de Carrossel.
 *
 * - Teto diário de imagens (GPT Image) nas últimas 24h, reservado de forma
 *   atômica no banco antes de cada chamada (`reserve_carousel_agent_image`).
 * - Quantos pedidos podem gerar ao mesmo tempo (o resto recebe 429).
 * - Tempo máximo por geração: depois disso, não começa imagem nova.
 * - Sem tentativa automática: cada card é gerado UMA vez; "Refazer" é manual.
 *
 * Carrossel tweet não gera imagem e não conta no teto.
 */

import type { Admin } from "./runs";
import { isStale } from "./shape";
import type { AgentFormat, AgentRun } from "./types";

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const n = Number(process.env[name]?.trim());
  return Number.isFinite(n) && n >= min ? Math.min(max, Math.round(n)) : fallback;
}

/** Imagens por 24h (janela móvel). `CAROUSEL_AGENT_DAILY_IMAGE_LIMIT`. */
export function dailyImageLimit(): number {
  return intEnv("CAROUSEL_AGENT_DAILY_IMAGE_LIMIT", 40, 0, 1000);
}

/** Pedidos gerando ao mesmo tempo. `CAROUSEL_AGENT_MAX_ACTIVE`. */
export function maxActiveRuns(): number {
  return intEnv("CAROUSEL_AGENT_MAX_ACTIVE", 2, 1, 20);
}

/**
 * Depois deste tempo a geração não começa imagem nova (a função morre em
 * 300s; uma imagem leva ~80–100s). O que faltar fica para "Retomar".
 */
export const GENERATION_TIME_BUDGET_MS = 190_000;

/** Quantas imagens um pedido novo deve consumir (estimativa para recusar cedo). */
export function estimatedImages(format: AgentFormat, cardCount: number | null): number {
  if (format === "tweet") return 0;
  if (format === "single") return 1;
  // Studio: só as fotos dos campos de imagem (no máximo ~1 por card).
  if (format === "studio") return cardCount ?? 7;
  return cardCount ?? 7;
}

export async function imagesUsedLast24h(admin: Admin): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { count } = await admin
    .from("carousel_agent_image_usage")
    .select("id", { count: "exact", head: true })
    .gt("created_at", since);
  return count ?? 0;
}

/**
 * Zera o teto diário na hora (botão "Zerar limite" da aba, só admin): apaga as
 * reservas das últimas 24h. O teto continua valendo daqui para a frente.
 * Retorna quantas imagens estavam contando.
 */
export async function resetImageUsage(admin: Admin): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { count, error } = await admin
    .from("carousel_agent_image_usage")
    .delete({ count: "exact" })
    .gt("created_at", since);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Reserva uma imagem do teto diário. false = teto atingido, não gere. */
export async function reserveImage(admin: Admin, runId: string): Promise<boolean> {
  const { data, error } = await admin.rpc("reserve_carousel_agent_image", {
    p_run_id: runId,
    p_daily_limit: dailyImageLimit(),
  });
  if (error) {
    // Sem conseguir conferir o teto, não gasta.
    console.error("[carousel-agent] reserva de imagem falhou", error.message);
    return false;
  }
  return data === true;
}

export async function activeRunCount(admin: Admin, exceptId?: string): Promise<number> {
  const { data } = await admin
    .from("carousel_agent_runs")
    .select("id, status, generation_started_at, created_at")
    .in("status", ["queued", "generating"]);
  return ((data ?? []) as Pick<AgentRun, "id" | "status" | "generation_started_at" | "created_at">[]).filter(
    (r) => r.id !== exceptId && !isStale(r)
  ).length;
}

export type LimitProblem = { message: string; status: 429 };

/** Confere se um pedido (ou retomada) pode começar agora. */
export async function checkCanStart(
  admin: Admin,
  input: { images: number; exceptRunId?: string }
): Promise<LimitProblem | null> {
  const active = await activeRunCount(admin, input.exceptRunId);
  if (active >= maxActiveRuns()) {
    return {
      status: 429,
      message: `Já há ${active} pedido(s) gerando (máximo ${maxActiveRuns()} ao mesmo tempo). Tente de novo em alguns minutos.`,
    };
  }
  if (input.images > 0) {
    const limit = dailyImageLimit();
    const used = await imagesUsedLast24h(admin);
    if (used + input.images > limit) {
      return {
        status: 429,
        message: `Limite diário de imagens: ${used} de ${limit} usadas nas últimas 24h e este pedido precisa de ${input.images}. Tente mais tarde ou peça um carrossel tweet (não gasta imagem).`,
      };
    }
  }
  return null;
}
