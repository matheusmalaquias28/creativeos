import type { AgentCard, AgentFormat, AgentPlan, AgentRun, AgentRunOptions, AgentRunStatus } from "./types";

/** Linha do banco (ou payload do Realtime) → AgentRun. Seguro no navegador. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toAgentRun(row: any): AgentRun {
  return {
    ...row,
    mode: row.mode === "manual" ? "manual" : "ai",
    format: (["carousel", "single", "tweet", "studio"].includes(row.format) ? row.format : "carousel") as AgentFormat,
    options: (row.options && typeof row.options === "object" ? row.options : {}) as AgentRunOptions,
    status: row.status as AgentRunStatus,
    plan: (row.plan ?? null) as AgentPlan | null,
    cards: (Array.isArray(row.cards) ? row.cards : []) as AgentCard[],
  };
}

/** Uma geração parada há mais que isso morreu (a função tem teto de 300s). */
export const STALE_GENERATION_MS = 6 * 60_000;

export function isStale(
  run: Pick<AgentRun, "status" | "generation_started_at"> & { created_at?: string },
  now = Date.now()
): boolean {
  if (run.status !== "generating" && run.status !== "queued") return false;
  const started = run.generation_started_at ?? run.created_at;
  if (!started) return run.status === "queued";
  return now - Date.parse(started) > STALE_GENERATION_MS;
}
