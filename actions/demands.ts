"use server";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type DemandUpdate = Database["public"]["Tables"]["creative_demands"]["Update"];

export type DemandStatusState = {
  error?: string;
  success?: boolean;
};

export type LinkDemandClientState = {
  error?: string;
  success?: boolean;
  clientId?: string;
  clientName?: string;
};

const MAX_ELAPSED_SECONDS = 3600; // 1 hora

export async function updateDemandStatusAction(
  demandId: string,
  status: string
): Promise<DemandStatusState> {
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("creative_demands")
    .select("started_at")
    .eq("id", demandId)
    .single();

  const now = new Date();
  const isStarting = status === "Fazendo";
  const isCompleted = status === "Concluída";

  const update: DemandUpdate = {
    status,
    updated_at: now.toISOString(),
  };

  if (isStarting) {
    update.started_at = now.toISOString();
    update.completed_at = null;
    update.elapsed_seconds = null;
  }

  if (isCompleted) {
    update.is_archived = true;
    update.completed_at = now.toISOString();

    if (current?.started_at) {
      const startedAt = new Date(current.started_at);
      const rawElapsed = Math.round((now.getTime() - startedAt.getTime()) / 1000);
      update.elapsed_seconds = Math.min(rawElapsed, MAX_ELAPSED_SECONDS);
    }
  } else {
    update.is_archived = false;
  }

  const { data, error } = await supabase
    .from("creative_demands")
    .update(update)
    .eq("id", demandId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: "Não foi possível atualizar a demanda." };
  }

  return { success: true };
}

export async function archiveDemandAction(demandId: string): Promise<DemandStatusState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_demands")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", demandId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Não foi possível arquivar a demanda." };

  return { success: true };
}

export async function markDemandAsReadAction(demandId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("creative_demands")
    .update({ is_new: false })
    .eq("id", demandId);
}

export async function linkDemandToClientAction(
  demandId: string,
  clientId: string
): Promise<LinkDemandClientState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (clientError) {
    return { error: clientError.message };
  }

  if (!client) {
    return { error: "Cliente não encontrado ou sem permissão." };
  }

  const { data, error } = await supabase
    .from("creative_demands")
    .update({
      client_id: client.id,
      client_not_found: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", demandId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: "Não foi possível vincular a demanda." };
  }

  return {
    success: true,
    clientId: client.id,
    clientName: client.name,
  };
}
