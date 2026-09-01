"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mergeLegacyDemandFlowIntoClient } from "@/services/flow";
import { linkUnmatchedDemandsByExternalName } from "@/lib/demands/link-unmatched-siblings";
import type { Database, Json } from "@/types/database";
import type { DemandArte } from "@/types/demand";

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
  linkedCount?: number;
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

const MAX_ARTE_FIELD = 4000;

function sanitizeArte(value: unknown): DemandArte {
  const r = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, MAX_ARTE_FIELD) : "");
  return {
    headline: str(r.headline),
    subheadline: str(r.subheadline),
    informacoesExtras: str(r.informacoesExtras),
    cta: str(r.cta),
    linkReferencias: str(r.linkReferencias),
  };
}

/** Salva os textos do briefing das artes (coluna jsonb `artes`). */
export async function updateDemandArtesAction(
  demandId: string,
  artes: DemandArte[]
): Promise<DemandStatusState> {
  if (!Array.isArray(artes)) {
    return { error: "Formato de artes inválido." };
  }

  const supabase = await createClient();
  const sanitized = artes.map(sanitizeArte);

  const { data, error } = await supabase
    .from("creative_demands")
    .update({ artes: sanitized as unknown as Json, updated_at: new Date().toISOString() })
    .eq("id", demandId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Não foi possível salvar o briefing das artes." };

  revalidatePath(`/demands/${demandId}`);
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

  const { data: demand, error: demandError } = await supabase
    .from("creative_demands")
    .select("id, client_name_external")
    .eq("id", demandId)
    .maybeSingle();

  if (demandError) {
    return { error: demandError.message };
  }

  if (!demand) {
    return { error: "Demanda não encontrada." };
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

  const siblingIds = await linkUnmatchedDemandsByExternalName(supabase, {
    clientId: client.id,
    externalName: demand.client_name_external,
  });

  // Se a demanda já tinha um fluxo próprio (gerado enquanto sem cliente), funde no
  // fluxo compartilhado do cliente em vez de descartar o trabalho já feito.
  await mergeLegacyDemandFlowIntoClient(demandId, client.id).catch((err) => {
    console.error("[linkDemandToClientAction] merge de fluxo falhou:", err);
  });

  const linkedCount = new Set([demandId, ...siblingIds]).size;

  return {
    success: true,
    clientId: client.id,
    clientName: client.name,
    linkedCount,
  };
}
