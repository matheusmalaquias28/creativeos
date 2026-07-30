import { createAdminClient } from "@/lib/supabase/admin";
import {
  MVP_BATCH_PAGE_SIZE,
  mvpTotalBatches,
  parseMvpPages,
  parseMvpReferences,
} from "@/types/mvp";
import { generateMvpSpace } from "./generate-space";

// Teto POR LOTE de 10 páginas — cada lote é uma rodada independente de
// spaces_edit, então o relógio zera a cada lote.
const BATCH_TIMEOUT_MS = 5 * 60 * 1000;
const CANCEL_POLL_MS = 4000;

/**
 * Gera o Space do MVP em lotes de 10 páginas, gravando o progresso
 * (`generated_batches`/`total_batches`) a cada lote — é o que alimenta o botão
 * dinâmico "lote N de X" e permite retomar de onde parou após falha/pausa.
 * Sempre chamado dentro de um `after()`. O botão "Pausar" seta
 * `cancel_requested` no banco, que o poller detecta e aborta o lote em curso.
 */
export async function triggerMvpGeneration(projectId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: project, error } = await supabase
    .from("mvp_projects")
    .select(
      "id, title, logo_url, reference_urls, pages, space_id, space_url, generated_batches"
    )
    .eq("id", projectId)
    .single();

  if (error || !project) return;

  const pages = parseMvpPages(project.pages);
  const referenceUrls = parseMvpReferences(project.reference_urls);
  const totalBatches = mvpTotalBatches(pages.length);
  // Retomada: lotes já concluídos não são refeitos (nem re-cobrados).
  const startBatch = Math.min(project.generated_batches ?? 0, totalBatches);
  let space =
    project.space_id && project.space_url
      ? { spaceId: project.space_id, spaceUrl: project.space_url }
      : null;

  await supabase
    .from("mvp_projects")
    .update({
      status: "generating",
      total_batches: totalBatches,
      requested_at: new Date().toISOString(),
      error: null,
      cancel_requested: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  for (let batch = startBatch; batch < totalBatches; batch++) {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(
      () =>
        controller.abort(
          new Error(`Tempo limite de 5 minutos atingido no lote ${batch + 1}/${totalBatches}`)
        ),
      BATCH_TIMEOUT_MS
    );
    const cancelPoller = setInterval(() => {
      void supabase
        .from("mvp_projects")
        .select("cancel_requested")
        .eq("id", projectId)
        .maybeSingle()
        .then(({ data: row }) => {
          if (row?.cancel_requested) {
            controller.abort(new Error("Cancelado pelo operador"));
          }
        });
    }, CANCEL_POLL_MS);

    try {
      const batchPages = pages.slice(
        batch * MVP_BATCH_PAGE_SIZE,
        (batch + 1) * MVP_BATCH_PAGE_SIZE
      );
      const result = await generateMvpSpace(
        {
          projectId: project.id,
          title: project.title,
          logoUrl: project.logo_url,
          referenceUrls,
          pages: batchPages,
          existingSpace: space,
        },
        { signal: controller.signal }
      );
      space = { spaceId: result.spaceId, spaceUrl: result.spaceUrl };

      await supabase
        .from("mvp_projects")
        .update({
          space_id: result.spaceId,
          space_url: result.spaceUrl,
          space_nodes: result.nodes,
          generated_batches: batch + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
    } catch (err) {
      const message =
        controller.signal.aborted && controller.signal.reason instanceof Error
          ? controller.signal.reason.message
          : err instanceof Error
            ? err.message
            : "Erro desconhecido";

      await supabase
        .from("mvp_projects")
        .update({
          status: "failed",
          error: `Lote ${batch + 1}/${totalBatches}: ${message}`,
          cancel_requested: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
      return;
    } finally {
      clearTimeout(timeoutTimer);
      clearInterval(cancelPoller);
    }
  }

  await supabase
    .from("mvp_projects")
    .update({
      status: "ready",
      generated_at: new Date().toISOString(),
      cancel_requested: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
}

/**
 * Organiza o docx em páginas via Claude, fora do request, trecho a trecho.
 * Cada trecho concluído é persistido (pages + organize_progress) — se algo
 * falhar no meio, o "Tentar de novo" retoma do checkpoint em vez de refazer
 * (e re-pagar) o que já deu certo. Falha vira status "organize_failed".
 */
export async function triggerMvpOrganization(projectId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("mvp_projects")
    .select("id, raw_content, pages, organize_progress")
    .eq("id", projectId)
    .single();

  if (!project?.raw_content) return;

  try {
    const { organizeMvpPages } = await import("./organize-pages");
    const startChunk = project.organize_progress ?? 0;
    const pages = await organizeMvpPages(project.raw_content, {
      startChunk,
      initialPages: parseMvpPages(project.pages),
      onProgress: async ({ pages: partial, chunksDone }) => {
        await supabase
          .from("mvp_projects")
          .update({
            pages: partial,
            organize_progress: chunksDone,
            updated_at: new Date().toISOString(),
          })
          .eq("id", projectId);
      },
    });
    await supabase
      .from("mvp_projects")
      .update({
        status: "organized",
        pages,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
  } catch (err) {
    await supabase
      .from("mvp_projects")
      .update({
        status: "organize_failed",
        error: err instanceof Error ? err.message : "Erro desconhecido",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
  }
}
