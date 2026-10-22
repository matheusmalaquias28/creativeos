import {
  resolveDemandClient,
  backfillClientExternalId,
} from "@/lib/demands/match-client";
import { resolveDemandDriveFolder } from "@/lib/export/drive-folder";
import { parseVideoDemandPayload } from "@/lib/video-demands/parse-payload";
import { VIDEO_DEMAND_INITIAL_STATUS } from "@/types/video-demand";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type VideoDemandInsert = Database["public"]["Tables"]["video_demands"]["Insert"];

export type VideoIngestResult =
  | { ok: true; demandId: string; externalId: string; clientNotFound: boolean }
  | { ok: false; status: number; error: string };

function normalizeStatus(status: string | null | undefined): string {
  const trimmed = status?.trim();
  return trimmed || VIDEO_DEMAND_INITIAL_STATUS;
}

function parseDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/**
 * Persiste uma demanda de vídeo em `video_demands` (upsert por `external_id`),
 * resolvendo o cliente pela mesma lógica das demandas de arte (ID fixo do WAR,
 * com fallback por nome). Usado tanto pelo webhook dedicado `/videos` quanto pelo
 * webhook de demandas quando o payload chega com `tipo: "video"`.
 */
export async function ingestVideoDemand(
  supabase: ReturnType<typeof createAdminClient>,
  body: unknown
): Promise<VideoIngestResult> {
  const parsed = parseVideoDemandPayload(body);
  if (!parsed) {
    return {
      ok: false,
      status: 400,
      error: "Payload inválido: id e clientName são obrigatórios",
    };
  }

  const matchedClient = await resolveDemandClient({
    externalClientId: parsed.externalClientId,
    clientName: parsed.clientName,
  });
  const clientNotFound = !matchedClient;

  if (matchedClient && !matchedClient.matchedByExternalId && parsed.externalClientId) {
    await backfillClientExternalId(supabase, matchedClient.id, parsed.externalClientId);
  }

  const driveFolder = resolveDemandDriveFolder([
    parsed.briefing.driveEditados,
    parsed.briefing.driveMateriais,
  ]);

  const row: VideoDemandInsert = {
    external_id: parsed.externalId,
    client_id: matchedClient?.id ?? null,
    client_name_external: parsed.clientName,
    client_not_found: clientNotFound,
    tipo: parsed.tipo || "video",
    categoria: parsed.categoria || null,
    prioridade: parsed.prioridade || null,
    squad: parsed.squad || null,
    gestor: parsed.gestor || null,
    webdesigner: parsed.webdesigner || null,
    solicitante: parsed.solicitante || null,
    briefing: parsed.briefing as VideoDemandInsert["briefing"],
    status: normalizeStatus(parsed.status),
    due_date: parseDate(parsed.dueDate),
    external_created_at: parseDate(parsed.externalCreatedAt),
    raw_payload: body as VideoDemandInsert["raw_payload"],
    drive_folder_url: driveFolder.url,
    drive_folder_id: driveFolder.id,
  };

  const { data, error } = await supabase
    .from("video_demands")
    .upsert(row, { onConflict: "external_id" })
    .select("id, external_id, client_not_found")
    .single();

  if (error) {
    console.error("[ingestVideoDemand]", error.message);
    return { ok: false, status: 500, error: error.message };
  }

  return {
    ok: true,
    demandId: data.id,
    externalId: data.external_id,
    clientNotFound: data.client_not_found,
  };
}
