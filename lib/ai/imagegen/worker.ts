/**
 * Worker de geração em lote com concorrência limitada.
 * Processa jobs com status 'queued' da tabela art_generation_job.
 * Geração é síncrona — sem webhook, sem polling externo.
 *
 * Timeout: cada job tem 2min para completar (configável via IMAGE_JOB_TIMEOUT_MS).
 * Cancelamento: ao marcar o job como 'failed' externamente, o worker respeita.
 */

import pLimit from "p-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateArt, type ImageSize, type AspectRatio } from "./client";
import { urlsToInlineDataParts, urlToInlineDataPart } from "./storage-refs";
import { compositeLogoFromBase64 } from "./logo-composite";
import { compilePrompt, buildOrderedRefs } from "./prompt-compiler";
import type { LogoPlacement } from "./logo-composite";
import type { CreativeProfile, ArtSpec, BriefingCopy, DemandReference } from "./prompt-compiler";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MAX_CONCURRENCY = Number(process.env.IMAGE_MAX_CONCURRENCY ?? "3");
const JOB_TIMEOUT_MS = Number(process.env.IMAGE_JOB_TIMEOUT_MS ?? String(2 * 60 * 1000)); // 2min

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JobRow = {
  id: string;
  demand_id: string;
  client_id: string | null;
  art_index: number;
  params: {
    headline?: string | null;
    subheadline?: string | null;
    cta?: string | null;
    informacoesExtras?: string | null;
    aspect_ratio?: string;
    image_size?: string;
    briefing_titulo?: string | null;
    briefing_tipo?: string | null;
    extra_reference_urls?: string[] | null;
    flow_logo_url?: string | null;
    flow_references?: { url: string; role: string | null }[] | null;
  };
};

type ProfileRow = {
  base_prompt: string;
  palette: string[];
  style_reference_urls: string[];
  logo_url: string | null;
  logo_mode: string;
  logo_placement: LogoPlacement;
  image_size: string;
  aspect_ratio: string;
};

type DemandRefRow = {
  storage_url: string;
  role: string | null;
  position: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout após ${ms / 1000}s: ${label}`));
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

// ---------------------------------------------------------------------------
// uploadArtToStorage
// ---------------------------------------------------------------------------

async function uploadArtToStorage(params: {
  base64: string;
  mimeType: string;
  jobId: string;
  versionNumber: number;
}): Promise<{ publicUrl: string; storagePath: string }> {
  const supabase = createAdminClient();
  const { base64, mimeType, jobId, versionNumber } = params;

  const ext = mimeType.includes("png") ? "png" : "jpg";
  const storagePath = `${jobId}/v${versionNumber}.${ext}`;
  const buffer = Buffer.from(base64, "base64");

  const { error } = await supabase.storage
    .from("art-generations")
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from("art-generations").getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl, storagePath };
}

// ---------------------------------------------------------------------------
// processJob — processa um único job (com timeout)
// ---------------------------------------------------------------------------

async function processJob(job: JobRow): Promise<void> {
  const supabase = createAdminClient();

  // Verifica se o job ainda está queued (pode ter sido cancelado externamente)
  const { data: current } = await supabase
    .from("art_generation_job")
    .select("status")
    .eq("id", job.id)
    .single();

  if (!current || current.status !== "queued") return;

  // Marca como processing
  await supabase
    .from("art_generation_job")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", job.id);

  try {
    await withTimeout(runJob(job, supabase), JOB_TIMEOUT_MS, `job ${job.id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    const { data: jobState } = await supabase
      .from("art_generation_job")
      .select("attempts, status")
      .eq("id", job.id)
      .single();

    // Não sobrescreve se o job foi cancelado manualmente (status=failed já)
    if (jobState?.status === "processing") {
      await supabase
        .from("art_generation_job")
        .update({
          status: "failed",
          error: message,
          attempts: (jobState?.attempts ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
  }
}

async function runJob(
  job: JobRow,
  supabase: ReturnType<typeof createAdminClient>
): Promise<void> {
  // Carrega perfil criativo do cliente
  const { data: profileData, error: profileError } = await supabase
    .from("client_creative_profile")
    .select("*")
    .eq("client_id", job.client_id!)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  const profile = profileData as ProfileRow | null;

  // Carrega referências pontuais da demanda (ordenadas por position)
  const { data: demandRefRows } = await supabase
    .from("demand_reference_image")
    .select("storage_url, role, position")
    .eq("demand_id", job.demand_id)
    .order("position", { ascending: true });

  const demandRefs: DemandReference[] = (demandRefRows ?? []).map((r: DemandRefRow) => ({
    url: r.storage_url,
    role: r.role,
  }));

  const flowRefs = job.params.flow_references ?? [];
  const flowLogoUrl = job.params.flow_logo_url ?? null;
  const usesFlowGraph = flowRefs.length > 0 || Boolean(flowLogoUrl);

  // Extra references resolved from legacy @(name) token path (non-flow queue)
  const extraRefs: DemandReference[] = (job.params.extra_reference_urls ?? []).map(
    (url) => ({
      url,
      role: "referência visual adicional indicada no prompt",
    })
  );

  const flowDemandRefs: DemandReference[] = flowRefs.map((ref) => ({
    url: ref.url,
    role: ref.role,
  }));

  const allDemandRefs = usesFlowGraph
    ? [...flowDemandRefs, ...demandRefs]
    : [...demandRefs, ...extraRefs];

  const artSpec: ArtSpec = {
    headline: job.params.headline,
    subheadline: job.params.subheadline,
    cta: job.params.cta,
    informacoesExtras: job.params.informacoesExtras,
    aspect_ratio: job.params.aspect_ratio ?? profile?.aspect_ratio ?? "1:1",
    image_size: job.params.image_size ?? profile?.image_size ?? "2K",
  };

  const briefing: BriefingCopy = {
    titulo: job.params.briefing_titulo,
    tipo: job.params.briefing_tipo,
  };

  const creativeProfile: CreativeProfile = {
    base_prompt: profile?.base_prompt ?? "",
    palette: (profile?.palette as string[]) ?? [],
    logo_mode: (profile?.logo_mode as "reference" | "composite") ?? "composite",
    style_reference_urls: usesFlowGraph
      ? []
      : ((profile?.style_reference_urls as string[]) ?? []),
  };

  const promptFinal = compilePrompt(creativeProfile, briefing, artSpec, allDemandRefs);

  const effectiveLogoUrl = flowLogoUrl ?? profile?.logo_url ?? null;

  const refUrls: string[] = [
    ...creativeProfile.style_reference_urls,
    ...(creativeProfile.logo_mode === "reference" && effectiveLogoUrl
      ? [effectiveLogoUrl]
      : []),
    ...allDemandRefs.map((r) => r.url),
  ];

  // Valida que a ordem bate com buildOrderedRefs (assertion em dev)
  const expectedCount = buildOrderedRefs(creativeProfile, allDemandRefs).length;
  if (refUrls.length !== expectedCount) {
    console.warn(`[worker] ref count mismatch: urls=${refUrls.length} vs compiler=${expectedCount}`);
  }

  const references = await urlsToInlineDataParts(refUrls);

  // Gera arte
  let { base64, mimeType } = await generateArt({
    prompt: promptFinal,
    references,
    imageSize: (artSpec.image_size as ImageSize) ?? "2K",
    aspectRatio: (artSpec.aspect_ratio as AspectRatio) ?? "1:1",
  });

  // Composição do logo se mode=composite
  if (creativeProfile.logo_mode === "composite" && effectiveLogoUrl) {
    const logoPart = await urlToInlineDataPart(effectiveLogoUrl);
    const composited = await compositeLogoFromBase64({
      artBase64: base64,
      artMimeType: mimeType,
      logoBase64: logoPart.inlineData.data,
      logoMimeType: logoPart.inlineData.mimeType,
      placement: profile?.logo_placement ?? {},
    });
    base64 = composited.base64;
    mimeType = composited.mimeType;
  }

  // Upload ao Storage
  const { publicUrl, storagePath } = await uploadArtToStorage({
    base64, mimeType, jobId: job.id, versionNumber: 1,
  });

  // Cria art_version v1
  const { error: versionError } = await supabase.from("art_version").insert({
    job_id: job.id,
    version_number: 1,
    result_url: publicUrl,
    storage_path: storagePath,
    instruction: null,
    is_current: true,
  });

  if (versionError) throw new Error(versionError.message);

  // Marca job como succeeded
  await supabase
    .from("art_generation_job")
    .update({
      status: "succeeded",
      prompt_final: promptFinal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
}

// ---------------------------------------------------------------------------
// runWorker — entry point
// ---------------------------------------------------------------------------

export async function runWorker(demandId?: string): Promise<{ processed: number }> {
  const supabase = createAdminClient();

  let query = supabase
    .from("art_generation_job")
    .select("id, demand_id, client_id, art_index, params")
    .eq("status", "queued")
    .order("created_at", { ascending: true });

  if (demandId) query = query.eq("demand_id", demandId);

  const { data: jobs, error } = await query;
  if (error) throw new Error(`Worker query failed: ${error.message}`);
  if (!jobs || jobs.length === 0) return { processed: 0 };

  const limit = pLimit(MAX_CONCURRENCY);
  await Promise.all((jobs as JobRow[]).map((job) => limit(() => processJob(job))));

  return { processed: jobs.length };
}
