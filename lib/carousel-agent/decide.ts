import { randomUUID } from "crypto";
import { createPost, publishPostNow } from "@/lib/instagram/posts";
import { validateScheduledAt } from "@/lib/instagram/schedule";
import type { InstagramPost } from "@/types/instagram";
import { AgentRunError, getRun, notifyAgent, toAgentRun, type Admin } from "./runs";
import type { AgentRun } from "./types";

/**
 * Aprova o carrossel: vira um post de verdade em `instagram_posts`, agendado
 * (`scheduledAt`) ou publicado agora (`null`). A troca de status é atômica
 * (só um clique aprova). Se o post não puder ser criado, o carrossel volta
 * para "Aguardando aprovação" com o erro.
 */
export async function approveRun(
  admin: Admin,
  runId: string,
  input: { userId: string; scheduledAt: string | null }
): Promise<{ run: AgentRun; post: InstagramPost }> {
  if (input.scheduledAt) {
    const problem = validateScheduledAt(input.scheduledAt);
    if (problem) throw new AgentRunError(problem);
  }

  const { data: claimed } = await admin
    .from("carousel_agent_runs")
    .update({ status: "approved", decided_by: input.userId, decided_at: new Date().toISOString(), error: null })
    .eq("id", runId)
    .eq("status", "awaiting_approval")
    .select("*")
    .maybeSingle();
  if (!claimed) throw new AgentRunError("Este carrossel não está aguardando aprovação.", 409);
  const run = toAgentRun(claimed);

  let post: InstagramPost;
  try {
    const items = run.cards.map((c) => {
      if (c.status !== "ready" || !c.url || !c.path) throw new AgentRunError(`O card ${c.index + 1} não está pronto.`);
      return { url: c.url, path: c.path };
    });
    post = await createPost(admin, {
      id: randomUUID(),
      carouselId: null,
      demandId: null,
      clientId: run.client_id,
      account: { igUserId: run.ig_user_id, username: run.ig_username },
      items,
      caption: run.caption,
      scheduledAt: input.scheduledAt,
      createdBy: input.userId,
    });
  } catch (e) {
    await admin
      .from("carousel_agent_runs")
      .update({ status: "awaiting_approval", decided_by: null, decided_at: null, error: e instanceof Error ? e.message : "Erro ao criar o post" })
      .eq("id", runId);
    throw e;
  }

  await admin
    .from("carousel_agent_runs")
    .update({ instagram_post_id: post.id, scheduled_at: input.scheduledAt })
    .eq("id", runId);

  // "Agora": publica na mesma requisição. Se falhar, o post fica `failed` com o
  // erro e dá para tentar de novo pelo histórico; a aprovação continua valendo.
  if (!input.scheduledAt) {
    post = await publishPostNow(admin, post.id);
  }

  const fresh = (await getRun(admin, runId)) ?? run;
  await notifyAgent(fresh, "approved");
  return { run: fresh, post };
}

export async function rejectRun(
  admin: Admin,
  runId: string,
  input: { userId: string; feedback: string | null }
): Promise<AgentRun> {
  const { data } = await admin
    .from("carousel_agent_runs")
    .update({
      status: "rejected",
      feedback: input.feedback?.trim().slice(0, 2000) || null,
      decided_by: input.userId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .in("status", ["awaiting_approval", "failed"])
    .select("*")
    .maybeSingle();
  if (!data) throw new AgentRunError("Este carrossel não pode mais ser reprovado.", 409);
  const run = toAgentRun(data);
  await notifyAgent(run, "rejected");
  return run;
}
