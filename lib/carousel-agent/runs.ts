import { createHmac } from "crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { listAccounts, type InstagramCredentials } from "@/lib/instagram/account";
import type { Json } from "@/types/database";
import { toAgentRun } from "./shape";
import type { AgentFormat, AgentRun, AgentRunMode, AgentRunOptions, AgentRunStatus } from "./types";

export type Admin = ReturnType<typeof createAdminClient>;

export class AgentRunError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "AgentRunError";
  }
}

export { toAgentRun };

export async function getRun(admin: Admin, id: string): Promise<AgentRun | null> {
  const { data } = await admin.from("carousel_agent_runs").select("*").eq("id", id).maybeSingle();
  return data ? toAgentRun(data) : null;
}

export async function listRuns(admin: Admin, limit = 60): Promise<AgentRun[]> {
  const { data } = await admin
    .from("carousel_agent_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(toAgentRun);
}

export function normalizeUsername(handle: string | null | undefined): string {
  return (handle ?? "").trim().replace(/^@+/, "").toLowerCase();
}

/** Conta conectada cujo @ é o do perfil. */
export function matchAccount(
  accounts: Pick<InstagramCredentials, "igUserId" | "username">[],
  handle: string | null | undefined
): Pick<InstagramCredentials, "igUserId" | "username"> | null {
  const wanted = normalizeUsername(handle);
  if (!wanted) return null;
  return accounts.find((a) => normalizeUsername(a.username) === wanted) ?? null;
}

export async function resolveProfileAccount(handle: string | null | undefined) {
  if (!normalizeUsername(handle)) {
    throw new AgentRunError("O perfil não tem @ do Instagram cadastrado (Carrosséis → Perfis).", 422);
  }
  const accounts = await listAccounts();
  const account = matchAccount(accounts, handle);
  if (!account) {
    const connected = accounts.map((a) => `@${a.username ?? a.igUserId}`).join(", ");
    throw new AgentRunError(
      `A conta ${handle} não está conectada para publicar. Contas conectadas: ${connected || "nenhuma"}.`,
      422
    );
  }
  return account;
}

export type CreateRunInput = {
  profile: { id: string; client_id: string | null; name: string; instagram_handle: string | null };
  account: Pick<InstagramCredentials, "igUserId" | "username">;
  mode: AgentRunMode;
  format: AgentFormat;
  options: AgentRunOptions;
  input: string;
  cardCount: number | null;
  scheduledAt: string | null;
  externalRef: string | null;
  callbackUrl: string | null;
};

export async function insertRun(admin: Admin, input: CreateRunInput): Promise<AgentRun> {
  const { data, error } = await admin
    .from("carousel_agent_runs")
    .insert({
      profile_id: input.profile.id,
      client_id: input.profile.client_id,
      profile_name: input.profile.name,
      ig_user_id: input.account.igUserId,
      ig_username: input.account.username,
      mode: input.mode,
      format: input.format,
      options: input.options as Json,
      input: input.input,
      card_count: input.cardCount,
      scheduled_at: input.scheduledAt,
      status: "queued",
      external_ref: input.externalRef,
      callback_url: input.callbackUrl,
    })
    .select("*")
    .single();
  if (error || !data) throw new AgentRunError(error?.message ?? "Não foi possível criar o carrossel", 500);
  return toAgentRun(data);
}

/** O que o agente vê do carrossel (status, cards prontos, legenda, post). */
export function publicRun(run: AgentRun, appUrl?: string | null) {
  return {
    id: run.id,
    status: run.status,
    format: run.format,
    title: run.plan?.title ?? null,
    profile: run.profile_name,
    instagram: run.ig_username ? `@${run.ig_username}` : run.ig_user_id,
    scheduledAt: run.scheduled_at,
    caption: run.caption || null,
    cards: run.cards.map((c) => ({ index: c.index, status: c.status, url: c.url, qaOk: c.qa?.ok ?? null })),
    error: run.error,
    feedback: run.feedback,
    instagramPostId: run.instagram_post_id,
    externalRef: run.external_ref,
    reviewUrl: appUrl ? new URL("/carousel/agente", appUrl).toString() : null,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  };
}

export function appUrl(): string | null {
  return process.env.CREATIVEOS_APP_URL?.trim() || null;
}

/**
 * Avisa o agente de uma mudança de status (pronto para aprovação, aprovado,
 * reprovado, falhou). Assinado com HMAC-SHA256 do corpo usando o mesmo
 * CAROUSEL_AGENT_SECRET (header `x-creativeos-signature: sha256=<hex>`).
 * Nunca lança: callback é melhor esforço.
 */
export async function notifyAgent(run: AgentRun, event: AgentRunStatus): Promise<void> {
  if (!run.callback_url) return;
  const secret = process.env.CAROUSEL_AGENT_SECRET?.trim();
  if (!secret) return;
  const body = JSON.stringify({ event, run: publicRun(run, appUrl()) });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  try {
    const res = await fetch(run.callback_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-creativeos-signature": `sha256=${signature}` },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.warn(`[carousel-agent] callback ${event} respondeu ${res.status}`);
  } catch (e) {
    console.warn("[carousel-agent] callback falhou", e instanceof Error ? e.message : e);
  }
}
