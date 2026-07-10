import { createAdminClient } from "@/lib/supabase/admin";
import { parseArtes } from "@/services/demands";
import { generateMagnificSpace } from "./generate-space";

/**
 * Roda a geração completa do Space e grava o resultado na demanda. Chamado tanto pelo
 * disparo automático do webhook quanto pela action manual — sempre dentro de um `after()`
 * pra não bloquear a resposta de quem chamou.
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
    })
    .eq("id", demandId);

  try {
    const clientsRel = demand.clients as { name?: string } | { name?: string }[] | null;
    const clientName = Array.isArray(clientsRel) ? clientsRel[0]?.name : clientsRel?.name;

    const result = await generateMagnificSpace({
      demandId: demand.id,
      clientId: demand.client_id,
      clientName: clientName ?? demand.client_name_external,
      tipo: demand.tipo,
      externalId: demand.external_id,
      artes: parseArtes(demand.artes),
    });

    await supabase
      .from("creative_demands")
      .update({
        magnific_space_status: "ready",
        magnific_space_id: result.spaceId,
        magnific_space_url: result.spaceUrl,
        magnific_space_generated_at: new Date().toISOString(),
      })
      .eq("id", demandId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";

    await supabase
      .from("creative_demands")
      .update({ magnific_space_status: "failed", magnific_space_error: message })
      .eq("id", demandId);
  }
}
