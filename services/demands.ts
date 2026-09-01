import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSchemaMissingError, schemaNotReadyError } from "@/lib/errors/database";
import type {
  CreativeDemand,
  CreativeDemandListItem,
  DashboardAnalytics,
  DashboardDelta,
  DemandArte,
  DemandBriefing,
  DemandMonthStat,
} from "@/types/demand";
import type { MagnificSpaceStatus } from "@/types/database";
import { parseStoredSpaceNodes } from "@/lib/magnific/space-state";
import {
  TRADITIONAL_DESIGNER_MINUTES as TRADITIONAL_MIN,
  HYBRID_DESIGNER_MINUTES as HYBRID_MIN,
} from "@/lib/demands/designer-time";

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

function firstArteHeadline(value: unknown): DemandArte[] {
  if (!Array.isArray(value)) return [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const headline = (item as Record<string, unknown>).headline;
    if (typeof headline === "string" && headline.trim()) {
      return [
        {
          headline: headline.trim(),
          subheadline: "",
          informacoesExtras: "",
          cta: "",
          linkReferencias: "",
        },
      ];
    }
  }
  return [];
}

const DEMAND_LIST_SELECT =
  "id, external_id, client_id, client_name_external, client_not_found, tipo, gestor, status, is_archived, is_new, started_at, completed_at, elapsed_seconds, due_date, external_created_at, created_at, updated_at, briefing, artes, magnific_space_id, magnific_space_url, magnific_space_status, magnific_space_error, magnific_space_nodes, clients(name)";

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
    artes: firstArteHeadline(row.artes),
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
    magnific_space_nodes: parseStoredSpaceNodes(row.magnific_space_nodes),
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
    magnific_space_nodes: parseStoredSpaceNodes(row.magnific_space_nodes),
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

const CLOSED_STATUSES = new Set(["Concluída", "Cancelada"]);

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function delta(current: number, previous: number): DashboardDelta {
  const pct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  return { current, previous, pct };
}

/**
 * Analytics consolidado do dashboard: série mensal (recortada para a janela de
 * atividade), comparativos mês/semana com o período anterior, distribuição por
 * status e métricas de produtividade. Usa a data efetiva da demanda
 * (external_created_at quando disponível) para refletir quando ela realmente
 * aconteceu, não quando foi importada.
 */
export const getDashboardAnalytics = cache(async (): Promise<DashboardAnalytics> => {
  const supabase = await createClient();

  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const { data, error } = await supabase
    .from("creative_demands")
    .select("created_at, external_created_at, completed_at, artes, elapsed_seconds, status")
    .order("created_at", { ascending: true });

  if (error) {
    return {
      months: [],
      demandsMonth: delta(0, 0),
      artesMonth: delta(0, 0),
      demandsWeek: delta(0, 0),
      artesWeek: delta(0, 0),
      statusCounts: [],
      activeDemands: 0,
      completedThisMonth: 0,
      avgTurnaroundMinutes: null,
      totalDemands: 0,
      totalArtes: 0,
      savedMinutesMonth: 0,
    };
  }

  const rows = data ?? [];

  const currentKey = monthKey(now);
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weekStart = now.getTime() - weekMs;
  const prevWeekStart = now.getTime() - 2 * weekMs;

  // Comparativo mensal justo: mês-até-agora vs. o MESMO intervalo do mês passado.
  // Sem isso, no dia 1º um mês parcial (ex.: 4) comparado ao mês cheio anterior
  // (ex.: 106) mostraria -96%, o que é enganoso.
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const msIntoMonth = now.getTime() - monthStart.getTime();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const prevMonthCutoff = prevMonthStart + msIntoMonth;

  const byMonth: Record<string, { demands: number; artes: number; elapsed: number[] }> = {};
  const statusMap: Record<string, number> = {};

  let demandsMonthCur = 0, demandsMonthPrev = 0, artesMonthCur = 0, artesMonthPrev = 0;
  let demandsWeekCur = 0, demandsWeekPrev = 0, artesWeekCur = 0, artesWeekPrev = 0;
  let activeDemands = 0, completedThisMonth = 0, totalDemands = 0, totalArtes = 0;
  const turnaroundList: number[] = [];

  for (const row of rows) {
    const effective = new Date(row.external_created_at ?? row.created_at);
    const artes = Array.isArray(row.artes) ? row.artes.length : 0;
    const status = row.status ? String(row.status) : "Sem status";
    const t = effective.getTime();

    totalDemands += 1;
    totalArtes += artes;
    statusMap[status] = (statusMap[status] ?? 0) + 1;
    if (!CLOSED_STATUSES.has(status)) activeDemands += 1;

    if (typeof row.elapsed_seconds === "number" && row.elapsed_seconds > 0) {
      turnaroundList.push(row.elapsed_seconds);
    }

    // Série mensal (últimos 12 meses)
    if (effective >= since) {
      const key = monthKey(effective);
      (byMonth[key] ??= { demands: 0, artes: 0, elapsed: [] });
      byMonth[key].demands += 1;
      byMonth[key].artes += artes;
      if (typeof row.elapsed_seconds === "number") byMonth[key].elapsed.push(row.elapsed_seconds);
    }

    // Comparativo mensal (mês-até-agora vs. mesmo intervalo do mês passado)
    if (t >= monthStart.getTime()) { demandsMonthCur += 1; artesMonthCur += artes; }
    else if (t >= prevMonthStart && t < prevMonthCutoff) { demandsMonthPrev += 1; artesMonthPrev += artes; }

    // Comparativo semanal
    if (t >= weekStart) { demandsWeekCur += 1; artesWeekCur += artes; }
    else if (t >= prevWeekStart) { demandsWeekPrev += 1; artesWeekPrev += artes; }

    // Concluídas neste mês (pela data de conclusão)
    if (status === "Concluída" && row.completed_at) {
      if (monthKey(new Date(row.completed_at)) === currentKey) completedThisMonth += 1;
    }
  }

  // Constrói série mensal preenchendo buracos, recortada a partir do 1º mês com atividade
  const filled: DemandMonthStat[] = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = monthKey(date);
    const stat = byMonth[key];
    filled.push({
      month: key,
      label: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      total_demands: stat?.demands ?? 0,
      total_artes: stat?.artes ?? 0,
      avg_elapsed_minutes:
        stat && stat.elapsed.length > 0
          ? Math.round(stat.elapsed.reduce((a, b) => a + b, 0) / stat.elapsed.length / 60)
          : null,
    });
  }
  const firstActive = filled.findIndex((m) => m.total_demands > 0 || m.total_artes > 0);
  // Mostra da 1ª atividade até agora; se não há dados, mostra os últimos 6 meses.
  const months = firstActive === -1 ? filled.slice(-6) : filled.slice(firstActive);

  const statusCounts = Object.entries(statusMap)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const avgTurnaroundMinutes =
    turnaroundList.length > 0
      ? Math.round(turnaroundList.reduce((a, b) => a + b, 0) / turnaroundList.length / 60)
      : null;

  const savedMinutesMonth =
    demandsMonthCur * (TRADITIONAL_MIN - HYBRID_MIN);

  return {
    months,
    demandsMonth: delta(demandsMonthCur, demandsMonthPrev),
    artesMonth: delta(artesMonthCur, artesMonthPrev),
    demandsWeek: delta(demandsWeekCur, demandsWeekPrev),
    artesWeek: delta(artesWeekCur, artesWeekPrev),
    statusCounts,
    activeDemands,
    completedThisMonth,
    avgTurnaroundMinutes,
    totalDemands,
    totalArtes,
    savedMinutesMonth,
  };
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
