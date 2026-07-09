import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";
import { isSchemaMissingError, schemaNotReadyError } from "@/lib/errors/database";
import type {
  CreativeDemand,
  CreativeDemandListItem,
  DemandArte,
  DemandBriefing,
  DemandMonthStat,
} from "@/types/demand";
import type { MagnificSpaceStatus } from "@/types/database";

export const getNewDemandsCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("creative_demands")
    .select("id", { count: "exact", head: true })
    .eq("is_new", true)
    .eq("is_archived", false);

  if (error) return 0;
  return count ?? 0;
});

function throwIfDbError(error: { message: string }) {
  if (isSchemaMissingError(error.message)) {
    throw schemaNotReadyError(error.message);
  }
  throw new Error(error.message);
}

function parseBriefingSummary(value: unknown): DemandBriefing {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    titulo: typeof record.titulo === "string" ? record.titulo : "",
    instagramCliente: "",
    tipo: typeof record.tipo === "string" ? record.tipo : "",
    quantidadeArtes: null,
    materiaisEditados: "",
    driveMateriais: "",
  };
}

function parseArtesCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

const DEMAND_LIST_SELECT =
  "id, external_id, client_id, client_name_external, client_not_found, tipo, gestor, status, is_archived, is_new, started_at, completed_at, elapsed_seconds, due_date, external_created_at, created_at, updated_at, briefing, artes, magnific_space_id, magnific_space_url, magnific_space_status, magnific_space_error, clients(name)";

function mapDemandListRow(
  row: Record<string, unknown>,
  clientName?: string | null
): CreativeDemandListItem {
  const artesCount = parseArtesCount(row.artes);
  return {
    id: String(row.id),
    external_id: String(row.external_id),
    client_id: row.client_id ? String(row.client_id) : null,
    client_name_external: String(row.client_name_external),
    client_not_found: Boolean(row.client_not_found),
    tipo: row.tipo ? String(row.tipo) : null,
    squad: null,
    gestor: row.gestor ? String(row.gestor) : null,
    webdesigner: null,
    solicitante: null,
    briefing: parseBriefingSummary(row.briefing),
    artes: [],
    artes_count: artesCount,
    status: row.status ? String(row.status) : null,
    is_archived: Boolean(row.is_archived),
    is_new: Boolean(row.is_new),
    started_at: row.started_at ? String(row.started_at) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    elapsed_seconds: typeof row.elapsed_seconds === "number" ? row.elapsed_seconds : null,
    due_date: row.due_date ? String(row.due_date) : null,
    external_created_at: row.external_created_at
      ? String(row.external_created_at)
      : null,
    magnific_space_id: row.magnific_space_id ? String(row.magnific_space_id) : null,
    magnific_space_url: row.magnific_space_url ? String(row.magnific_space_url) : null,
    magnific_space_status:
      (row.magnific_space_status as MagnificSpaceStatus | undefined) ?? "not_generated",
    magnific_space_error: row.magnific_space_error ? String(row.magnific_space_error) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    client_name: clientName ?? null,
  };
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

export function parseArtes(value: unknown): DemandArte[] {
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
    is_archived: Boolean(row.is_archived),
    is_new: Boolean(row.is_new),
    started_at: row.started_at ? String(row.started_at) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    elapsed_seconds: typeof row.elapsed_seconds === "number" ? row.elapsed_seconds : null,
    due_date: row.due_date ? String(row.due_date) : null,
    external_created_at: row.external_created_at
      ? String(row.external_created_at)
      : null,
    magnific_space_id: row.magnific_space_id ? String(row.magnific_space_id) : null,
    magnific_space_url: row.magnific_space_url ? String(row.magnific_space_url) : null,
    magnific_space_status:
      (row.magnific_space_status as MagnificSpaceStatus | undefined) ?? "not_generated",
    magnific_space_error: row.magnific_space_error ? String(row.magnific_space_error) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    client_name: clientName ?? null,
  };
}

export const getDemandsForUser = cache(
  async (archived = false): Promise<CreativeDemandListItem[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("creative_demands")
      .select(DEMAND_LIST_SELECT)
      .eq("is_archived", archived)
      .order("created_at", { ascending: false });

    if (error) throwIfDbError(error);

    return (data ?? []).map((row) => {
      const clients = row.clients as { name?: string } | { name?: string }[] | null;
      const clientName = Array.isArray(clients) ? clients[0]?.name : clients?.name;
      return mapDemandListRow(row as Record<string, unknown>, clientName);
    });
  }
);

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

export const getDemandsMonthlyStats = cache(async (): Promise<DemandMonthStat[]> => {
  const supabase = await createClient();

  // Busca demands dos últimos 12 meses com campos necessários
  const since = new Date();
  since.setMonth(since.getMonth() - 11);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("creative_demands")
    .select("created_at, artes, elapsed_seconds")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  if (error) return [];

  const byMonth: Record<
    string,
    { demands: number; artes: number; elapsedList: number[] }
  > = {};

  for (const row of data ?? []) {
    const d = new Date(row.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) {
      byMonth[key] = { demands: 0, artes: 0, elapsedList: [] };
    }
    byMonth[key].demands += 1;
    const artes = Array.isArray(row.artes) ? row.artes.length : 0;
    byMonth[key].artes += artes;
    if (typeof row.elapsed_seconds === "number") {
      byMonth[key].elapsedList.push(row.elapsed_seconds);
    }
  }

  return Object.entries(byMonth).map(([month, stats]) => {
    const [year, m] = month.split("-");
    const date = new Date(Number(year), Number(m) - 1);
    const label = date.toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    });
    const avgElapsed =
      stats.elapsedList.length > 0
        ? Math.round(
            stats.elapsedList.reduce((a, b) => a + b, 0) /
              stats.elapsedList.length /
              60
          )
        : null;

    return {
      month,
      label,
      total_demands: stats.demands,
      total_artes: stats.artes,
      avg_elapsed_minutes: avgElapsed,
    };
  });
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
