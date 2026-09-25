import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bumpReferenceUsage } from "@/services/reference-assets";
import type { DirectionMeta, ReferenceRole } from "@/lib/ai/art-director/types";

export type PromptJobStatus =
  | "draft"
  | "writing_prompt"
  | "awaiting_approval"
  | "queued"
  | "processing"
  | "succeeded"
  | "failed";

export type JobReference = {
  id: string;
  asset_id: string | null;
  storage_url: string;
  role: ReferenceRole;
  intent: string | null;
  position: number;
  source: "ai" | "manual" | "client_fixed";
};

export type PromptJob = {
  id: string;
  demand_id: string;
  client_id: string | null;
  art_index: number;
  status: PromptJobStatus;
  prompt_draft: string | null;
  prompt_edited: string | null;
  prompt_approved_at: string | null;
  direction: DirectionMeta | null;
  use_client_photos: boolean;
  params: Record<string, unknown>;
  error: string | null;
  references: JobReference[];
};

/** O texto que o operador está de fato editando. */
export function effectivePrompt(job: PromptJob): string {
  return job.prompt_edited ?? job.prompt_draft ?? "";
}

export async function getPromptJobsForDemand(demandId: string): Promise<PromptJob[]> {
  const supabase = await createClient();

  const { data: jobs, error } = await supabase
    .from("art_generation_job")
    .select(
      "id, demand_id, client_id, art_index, status, prompt_draft, prompt_edited, prompt_approved_at, direction, use_client_photos, params, error"
    )
    .eq("demand_id", demandId)
    .order("art_index", { ascending: true });

  if (error) throw new Error(error.message);
  if (!jobs?.length) return [];

  const { data: refs } = await supabase
    .from("art_job_reference")
    .select("id, job_id, asset_id, storage_url, role, intent, position, source")
    .in(
      "job_id",
      jobs.map((j) => j.id)
    )
    .order("position", { ascending: true });

  return jobs.map((job) => ({
    ...(job as unknown as Omit<PromptJob, "references">),
    references: ((refs ?? []) as (JobReference & { job_id: string })[])
      .filter((r) => r.job_id === job.id)
      .map(({ ...rest }) => rest as JobReference),
  }));
}

/**
 * Liga ou desliga as fotos reais do cliente nesta arte.
 *
 * Só marcar o flag não bastaria: a cena precisa ser reescrita contando com uma
 * pessoa real no quadro, então a troca sempre reescreve o prompt. Por isso o
 * toggle só existe enquanto a arte está aguardando aprovação.
 */
export async function setUseClientPhotos(
  jobId: string,
  useClientPhotos: boolean
): Promise<void> {
  const supabase = createAdminClient();

  const { data: job } = await supabase
    .from("art_generation_job")
    .select("status")
    .eq("id", jobId)
    .single();

  if (!job) throw new Error("Job não encontrado");
  if (job.status !== "awaiting_approval") {
    throw new Error("Só dá para mudar isso antes de aprovar a arte");
  }

  const { error } = await supabase
    .from("art_generation_job")
    .update({ use_client_photos: useClientPhotos, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) throw new Error(error.message);
}

/**
 * URL da versão atual de cada arte da demanda. Serve de estado inicial da tela
 * de prompts — o Realtime cobre o que chegar depois, mas quem volta à página
 * com as artes já prontas precisa vê-las no primeiro render.
 */
export async function getCurrentArtUrls(
  demandId: string
): Promise<Record<string, string>> {
  const supabase = await createClient();

  const { data: jobs } = await supabase
    .from("art_generation_job")
    .select("id")
    .eq("demand_id", demandId);

  const jobIds = (jobs ?? []).map((j) => j.id);
  if (jobIds.length === 0) return {};

  const { data: versions } = await supabase
    .from("art_version")
    .select("job_id, result_url")
    .in("job_id", jobIds)
    .eq("is_current", true);

  const out: Record<string, string> = {};
  for (const v of versions ?? []) {
    out[v.job_id as string] = v.result_url as string;
  }
  return out;
}

export async function saveEditedPrompt(jobId: string, prompt: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: job } = await supabase
    .from("art_generation_job")
    .select("prompt_draft, status")
    .eq("id", jobId)
    .single();

  if (!job) throw new Error("Job não encontrado");
  if (job.status !== "awaiting_approval") {
    throw new Error("Só dá para editar o prompt antes de aprovar");
  }

  const trimmed = prompt.trim();
  // Voltar ao texto original limpa a edição: preserva o sinal de que o
  // operador aceitou o rascunho como está (é o que a métrica de aprovação
  // sem edição mede).
  const edited = trimmed === (job.prompt_draft ?? "").trim() ? null : trimmed;

  const { error } = await supabase
    .from("art_generation_job")
    .update({ prompt_edited: edited, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) throw new Error(error.message);
}

async function approveJobs(jobIds: string[], userId: string | null): Promise<number> {
  if (jobIds.length === 0) return 0;

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from("art_generation_job")
    .update({
      status: "queued",
      prompt_approved_at: now,
      prompt_approved_by: userId,
      updated_at: now,
    })
    .in("id", jobIds)
    .eq("status", "awaiting_approval")
    .select("id");

  if (error) throw new Error(error.message);

  const approvedIds = (updated ?? []).map((r) => r.id as string);
  if (approvedIds.length === 0) return 0;

  const { data: refs } = await supabase
    .from("art_job_reference")
    .select("asset_id")
    .in("job_id", approvedIds);

  await bumpReferenceUsage(
    (refs ?? []).map((r) => r.asset_id as string | null).filter((id): id is string => Boolean(id))
  );

  return approvedIds.length;
}

export async function approvePrompt(jobId: string, userId: string | null): Promise<number> {
  return approveJobs([jobId], userId);
}

export async function approveAllPrompts(
  demandId: string,
  userId: string | null
): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("art_generation_job")
    .select("id")
    .eq("demand_id", demandId)
    .eq("status", "awaiting_approval");

  return approveJobs((data ?? []).map((r) => r.id as string), userId);
}

/** Remove uma referência de um job e reindexa as posições restantes. */
export async function removeJobReference(referenceId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: ref } = await supabase
    .from("art_job_reference")
    .select("job_id")
    .eq("id", referenceId)
    .single();

  if (!ref) return;

  await supabase.from("art_job_reference").delete().eq("id", referenceId);

  const { data: remaining } = await supabase
    .from("art_job_reference")
    .select("id")
    .eq("job_id", ref.job_id)
    .order("position", { ascending: true });

  await Promise.all(
    (remaining ?? []).map((row, i) =>
      supabase.from("art_job_reference").update({ position: i }).eq("id", row.id)
    )
  );
}

export async function addJobReference(input: {
  jobId: string;
  assetId: string | null;
  storageUrl: string;
  role: ReferenceRole;
  intent?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();

  const { count } = await supabase
    .from("art_job_reference")
    .select("id", { count: "exact", head: true })
    .eq("job_id", input.jobId);

  const { error } = await supabase.from("art_job_reference").insert({
    job_id: input.jobId,
    asset_id: input.assetId,
    storage_url: input.storageUrl,
    role: input.role,
    intent: input.intent ?? null,
    position: count ?? 0,
    source: "manual",
  });

  if (error) throw new Error(error.message);
}
