import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSchemaMissingError, schemaNotReadyError } from "@/lib/errors/database";
import { extractStatusPermitidos } from "@/lib/demands/war-status-callback";
import type {
  VideoBriefing,
  VideoDemandDetail,
  VideoDemandListItem,
} from "@/types/video-demand";

function throwIfDbError(error: { message: string }) {
  if (isSchemaMissingError(error.message)) {
    throw schemaNotReadyError(error.message);
  }
  throw new Error(error.message);
}

function parseBriefing(value: unknown): VideoBriefing {
  const r = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    titulo: str(r.titulo),
    instagramCliente: str(r.instagramCliente),
    prioridade: str(r.prioridade),
    quantidadeVideos: typeof r.quantidadeVideos === "number" ? r.quantidadeVideos : null,
    driveMateriais: str(r.driveMateriais),
    driveEditados: str(r.driveEditados),
    descricao: str(r.descricao),
  };
}

function mapRow(
  row: Record<string, unknown>,
  clientName?: string | null,
  clientSlug?: string | null
): VideoDemandListItem {
  return {
    id: String(row.id),
    external_id: String(row.external_id),
    client_id: row.client_id ? String(row.client_id) : null,
    client_name_external: String(row.client_name_external),
    client_not_found: Boolean(row.client_not_found),
    tipo: row.tipo ? String(row.tipo) : null,
    categoria: row.categoria ? String(row.categoria) : null,
    prioridade: row.prioridade ? String(row.prioridade) : null,
    squad: row.squad ? String(row.squad) : null,
    gestor: row.gestor ? String(row.gestor) : null,
    webdesigner: row.webdesigner ? String(row.webdesigner) : null,
    solicitante: row.solicitante ? String(row.solicitante) : null,
    briefing: parseBriefing(row.briefing),
    status: row.status ? String(row.status) : null,
    is_archived: Boolean(row.is_archived),
    is_new: Boolean(row.is_new),
    started_at: row.started_at ? String(row.started_at) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    elapsed_seconds: typeof row.elapsed_seconds === "number" ? row.elapsed_seconds : null,
    due_date: row.due_date ? String(row.due_date) : null,
    external_created_at: row.external_created_at ? String(row.external_created_at) : null,
    drive_folder_url: row.drive_folder_url ? String(row.drive_folder_url) : null,
    drive_folder_id: row.drive_folder_id ? String(row.drive_folder_id) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    client_name: clientName ?? null,
    client_slug: clientSlug ?? null,
    status_permitidos: extractStatusPermitidos(row.raw_payload),
  };
}

const VIDEO_LIST_SELECT =
  "id, external_id, client_id, client_name_external, client_not_found, tipo, categoria, prioridade, squad, gestor, webdesigner, solicitante, briefing, status, is_archived, is_new, started_at, completed_at, elapsed_seconds, due_date, external_created_at, drive_folder_url, drive_folder_id, raw_payload, created_at, updated_at, clients(name)";

export const getVideoDemandsForUser = cache(
  async (archived = false): Promise<VideoDemandListItem[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("video_demands")
      .select(VIDEO_LIST_SELECT)
      .eq("is_archived", archived)
      .order("created_at", { ascending: false });

    if (error) throwIfDbError(error);

    return (data ?? []).map((row) => {
      const clients = (row as Record<string, unknown>).clients as
        | { name?: string }
        | { name?: string }[]
        | null;
      const clientName = Array.isArray(clients) ? clients[0]?.name : clients?.name;
      return mapRow(row as Record<string, unknown>, clientName);
    });
  }
);

export const getVideoDemandById = cache(
  async (demandId: string): Promise<VideoDemandDetail | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("video_demands")
      .select("*, clients(name, slug)")
      .eq("id", demandId)
      .maybeSingle();

    if (error) throwIfDbError(error);
    if (!data) return null;

    const clients = data.clients as
      | { name?: string; slug?: string }
      | { name?: string; slug?: string }[]
      | null;
    const client = Array.isArray(clients) ? clients[0] : clients;
    return {
      ...mapRow(data as Record<string, unknown>, client?.name, client?.slug ?? null),
      raw_payload: (data as Record<string, unknown>).raw_payload ?? null,
    };
  }
);

export const getNewVideoDemandsCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("video_demands")
    .select("id", { count: "exact", head: true })
    .eq("is_new", true)
    .eq("is_archived", false);

  if (error) return 0;
  return count ?? 0;
});
