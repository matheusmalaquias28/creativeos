import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSchemaMissingError, schemaNotReadyError } from "@/lib/errors/database";
import type { CreativeDemand, CreativeDemandListItem, DemandArte, DemandBriefing } from "@/types/demand";

function throwIfDbError(error: { message: string }) {
  if (isSchemaMissingError(error.message)) {
    throw schemaNotReadyError(error.message);
  }
  throw new Error(error.message);
}

function parseBriefing(value: unknown): DemandBriefing {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    titulo: typeof record.titulo === "string" ? record.titulo : "",
    instagramCliente: typeof record.instagramCliente === "string" ? record.instagramCliente : "",
    tipo: typeof record.tipo === "string" ? record.tipo : "",
    quantidadeArtes:
      typeof record.quantidadeArtes === "number" ? record.quantidadeArtes : null,
    materiaisEditados:
      typeof record.materiaisEditados === "string" ? record.materiaisEditados : "",
    driveMateriais: typeof record.driveMateriais === "string" ? record.driveMateriais : "",
  };
}

function parseArtes(value: unknown): DemandArte[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      return {
        headline: typeof record.headline === "string" ? record.headline : "",
        subheadline: typeof record.subheadline === "string" ? record.subheadline : "",
        informacoesExtras:
          typeof record.informacoesExtras === "string" ? record.informacoesExtras : "",
        cta: typeof record.cta === "string" ? record.cta : "",
        linkReferencias:
          typeof record.linkReferencias === "string" ? record.linkReferencias : "",
      };
    })
    .filter((arte): arte is DemandArte => arte != null);
}

function mapDemandRow(
  row: Record<string, unknown>,
  clientName?: string | null
): CreativeDemandListItem {
  return {
    id: String(row.id),
    external_id: String(row.external_id),
    client_id: row.client_id ? String(row.client_id) : null,
    client_name_external: String(row.client_name_external),
    client_not_found: Boolean(row.client_not_found),
    tipo: row.tipo ? String(row.tipo) : null,
    squad: row.squad ? String(row.squad) : null,
    gestor: row.gestor ? String(row.gestor) : null,
    webdesigner: row.webdesigner ? String(row.webdesigner) : null,
    solicitante: row.solicitante ? String(row.solicitante) : null,
    briefing: parseBriefing(row.briefing),
    artes: parseArtes(row.artes),
    status: row.status ? String(row.status) : null,
    due_date: row.due_date ? String(row.due_date) : null,
    external_created_at: row.external_created_at
      ? String(row.external_created_at)
      : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    client_name: clientName ?? null,
  };
}

export const getDemandsForUser = cache(async (): Promise<CreativeDemandListItem[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_demands")
    .select("*, clients(name)")
    .order("created_at", { ascending: false });

  if (error) throwIfDbError(error);

  return (data ?? []).map((row) => {
    const clients = row.clients as { name?: string } | { name?: string }[] | null;
    const clientName = Array.isArray(clients) ? clients[0]?.name : clients?.name;
    return mapDemandRow(row as Record<string, unknown>, clientName);
  });
});

export const getDemandsByClientId = cache(
  async (clientId: string): Promise<CreativeDemand[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("creative_demands")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) throwIfDbError(error);
    return (data ?? []).map((row) => mapDemandRow(row as Record<string, unknown>));
  }
);

export const getDemandById = cache(async (demandId: string): Promise<CreativeDemandListItem | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_demands")
    .select("*, clients(name)")
    .eq("id", demandId)
    .maybeSingle();

  if (error) throwIfDbError(error);
  if (!data) return null;

  const clients = data.clients as { name?: string } | { name?: string }[] | null;
  const clientName = Array.isArray(clients) ? clients[0]?.name : clients?.name;
  return mapDemandRow(data as Record<string, unknown>, clientName);
});

export async function getUnmatchedDemandsCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("creative_demands")
    .select("id", { count: "exact", head: true })
    .eq("client_not_found", true);

  if (error) throwIfDbError(error);
  return count ?? 0;
}
