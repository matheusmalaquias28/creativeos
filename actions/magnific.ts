"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { triggerMagnificGeneration } from "@/lib/magnific/trigger-generation";

export type GenerateMagnificSpaceState = {
  error?: string;
  success?: boolean;
};

export async function generateMagnificSpaceAction(
  demandId: string
): Promise<GenerateMagnificSpaceState> {
  const supabase = await createClient();

  const { data: demand, error } = await supabase
    .from("creative_demands")
    .select("id, client_id, client_not_found")
    .eq("id", demandId)
    .single();

  if (error || !demand) return { error: "Demanda não encontrada" };
  if (!demand.client_id || demand.client_not_found) {
    return { error: "Demanda sem cliente vinculado" };
  }

  // Update condicional (neq generating) evita corrida em cliques duplicados: só um
  // request consegue transicionar o status, o outro recebe zero linhas afetadas.
  const { data: claimed, error: claimError } = await supabase
    .from("creative_demands")
    .update({
      magnific_space_status: "generating",
      magnific_space_requested_at: new Date().toISOString(),
      magnific_space_error: null,
    })
    .eq("id", demandId)
    .neq("magnific_space_status", "generating")
    .select("id")
    .maybeSingle();

  if (claimError) return { error: claimError.message };
  if (!claimed) return { error: "Já existe uma geração em andamento para esta demanda" };

  after(() => triggerMagnificGeneration(demandId));

  return { success: true };
}

export type CancelMagnificSpaceState = {
  error?: string;
  success?: boolean;
};

/**
 * Força o cancelamento de uma geração em andamento. Marca `magnific_space_cancel_requested`
 * (verificado pelo poller em trigger-generation.ts, que aborta a chamada em andamento) e já
 * grava o status como "failed" de imediato — cobre tanto o caso de uma geração realmente
 * travada (invocação já morta, ninguém vai ler o flag) quanto o caso de estar ativa.
 */
export async function cancelMagnificSpaceGenerationAction(
  demandId: string
): Promise<CancelMagnificSpaceState> {
  const supabase = await createClient();

  const { data: claimed, error } = await supabase
    .from("creative_demands")
    .update({
      magnific_space_status: "failed",
      magnific_space_error: "Cancelado pelo operador",
      magnific_space_cancel_requested: true,
    })
    .eq("id", demandId)
    .eq("magnific_space_status", "generating")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!claimed) return { error: "Nenhuma geração em andamento para cancelar" };

  return { success: true };
}
