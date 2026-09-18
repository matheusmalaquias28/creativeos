"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mergeLegacyDemandFlowIntoClient } from "@/services/flow";
import { linkUnmatchedDemandsByExternalName } from "@/lib/demands/link-unmatched-siblings";
import { notifyWarStatusChange } from "@/lib/demands/war-status-callback";
import { externalClientIdFromPayload } from "@/lib/demands/parse-make-payload";
import type { Database, Json } from "@/types/database";
import { DEMAND_WORKING_STATUS, isDoneStatus, type DemandArte } from "@/types/demand";

type DemandUpdate = Database["public"]["Tables"]["creative_demands"]["Update"];

/**
 * Grava (sobrescrevendo) o ID fixo do WAR em `clients.company_info.external_id`
 * a partir do `raw_payload` da demanda recém-vinculada. O ID da demanda é a fonte
 * da verdade após a mudança de termo no WAR, então ele prevalece sobre o que
 * estiver gravado no cliente. No-op quando o payload não traz ID ou ele já bate.
 */
async function adoptClientExternalId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  rawPayload: unknown
): Promise<void> {
  const externalId = externalClientIdFromPayload(rawPayload);
  if (!externalId) return;

  const { data } = await supabase
    .from("clients")
    .select("company_info")
    .eq("id", clientId)
    .maybeSingle();

  const info =
    data?.company_info && typeof data.company_info === "object"
      ? (data.company_info as Record<string, unknown>)
      : {};

  if (info.external_id === externalId) return;

  await supabase
    .from("clients")
    .update({ company_info: { ...info, external_id: externalId } })
    .eq("id", clientId);
}

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
    .select("started_at, external_id, raw_payload")
    .eq("id", demandId)
    .single();

  const now = new Date();
  const isStarting = status === DEMAND_WORKING_STATUS;
  const isCompleted = isDoneStatus(status);

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

  // Notifica o WAR sobre a mudança (best-effort — não bloqueia o sucesso da ação).
  await notifyWarStatusChange({
    externalId: current?.external_id ?? null,
    status,
    rawPayload: current?.raw_payload ?? null,
  });

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
    // Preserva as imagens de referência (não editáveis no form; vêm do webhook).
    imagensReferencias: Array.isArray(r.imagensReferencias)
      ? r.imagensReferencias
          .filter((url): url is string => typeof url === "string" && url.trim().length > 0)
          .slice(0, 20)
      : [],
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
    .select("id, client_name_external, raw_payload")
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

  // A demanda carrega o ID fixo do cliente no WAR (o "certo"). Ao vincular
  // manualmente, gravamos esse ID no cliente do CreativeOS — sobrescrevendo o
  // antigo — para que as próximas demandas do mesmo cliente casem direto pelo ID
  // (ver resolveDemandClient) em vez de caírem no fallback por nome.
  await adoptClientExternalId(supabase, client.id, demand.raw_payload).catch(
    (err) => {
      console.error("[linkDemandToClientAction] adoção de external_id falhou:", err);
    }
  );

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
