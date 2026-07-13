import { createAdminClient } from "@/lib/supabase/admin";
import { parseArtes } from "@/services/demands";
import { generateMagnificSpace } from "./generate-space";

const TIMEOUT_MS = 2 * 60 * 1000;
const CANCEL_POLL_MS = 4000;

/**
 * Roda a geração completa do Space e grava o resultado na demanda. Chamado tanto pelo
 * disparo automático do webhook quanto pela action manual — sempre dentro de um `after()`
 * pra não bloquear a resposta de quem chamou.
 *
 * Como o agente MCP roda inteiramente dentro desta invocação (não há um worker/fila
 * separado), o cancelamento manual (botão "Pausar") só consegue interromper a chamada
 * em andamento via um flag no banco (`magnific_space_cancel_requested`) que é verificado
 * periodicamente aqui e aciona o mesmo AbortController do timeout automático.
 */
export async function triggerMagnificGeneration(demandId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: demand, error } = await supabase
    .from("creative_demands")
    .select("id, client_id, client_name_external, tipo, external_id, artes, clients(name)")
    .eq("id", demandId)
    .single();

  if (error || !demand?.client_id) return;

  await supabase
    .from("creative_demands")
    .update({
      magnific_space_status: "generating",
      magnific_space_requested_at: new Date().toISOString(),
      magnific_space_error: null,
      magnific_space_cancel_requested: false,
    })
    .eq("id", demandId);

  const controller = new AbortController();
  const timeoutTimer = setTimeout(
    () => controller.abort(new Error("Tempo limite de 2 minutos atingido")),
    TIMEOUT_MS
  );
  const cancelPoller = setInterval(() => {
    void supabase
      .from("creative_demands")
      .select("magnific_space_cancel_requested")
      .eq("id", demandId)
      .maybeSingle()
      .then(({ data: row }) => {
        if (row?.magnific_space_cancel_requested) {
          controller.abort(new Error("Cancelado pelo operador"));
        }
      });
  }, CANCEL_POLL_MS);

  try {
    const clientsRel = demand.clients as { name?: string } | { name?: string }[] | null;
    const clientName = Array.isArray(clientsRel) ? clientsRel[0]?.name : clientsRel?.name;

    const result = await generateMagnificSpace(
      {
        demandId: demand.id,
        clientId: demand.client_id,
        clientName: clientName ?? demand.client_name_external,
        tipo: demand.tipo,
        externalId: demand.external_id,
        artes: parseArtes(demand.artes),
      },
      { signal: controller.signal }
    );

    await supabase
      .from("creative_demands")
      .update({
        magnific_space_status: "ready",
        magnific_space_id: result.spaceId,
        magnific_space_url: result.spaceUrl,
        magnific_space_nodes: result.nodes,
        magnific_space_generated_at: new Date().toISOString(),
        magnific_space_cancel_requested: false,
      })
      .eq("id", demandId);
  } catch (err) {
    const message =
      controller.signal.aborted && controller.signal.reason instanceof Error
        ? controller.signal.reason.message
        : err instanceof Error
          ? err.message
          : "Erro desconhecido";

    await supabase
      .from("creative_demands")
      .update({
        magnific_space_status: "failed",
        magnific_space_error: message,
        magnific_space_cancel_requested: false,
      })
      .eq("id", demandId);
  } finally {
    clearTimeout(timeoutTimer);
    clearInterval(cancelPoller);
  }
}
