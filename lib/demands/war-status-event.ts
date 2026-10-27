import type { createAdminClient } from "@/lib/supabase/admin";
import { isDoneStatus } from "@/types/demand";

type UnknownRecord = Record<string, unknown>;

export type WarStatusEvent = { externalId: string; status: string; event: string | null };

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value != null ? String(value).trim() : "";
}

/**
 * Evento de mudança de status vindo do WAR (`event: "demanda.status"`): chega
 * no MESMO webhook da criação, mas só com `id`/`status`/`previousStatus` — sem
 * briefing nem artes. Tratado como criação, o upsert apagava título, artes e o
 * `raw_payload` (com o `callback`) da demanda. Reconhece pelo `event` ou, sem
 * ele, por ter `previousStatus` e nenhum conteúdo de demanda.
 */
export function parseWarStatusEvent(payload: unknown): WarStatusEvent | null {
  const record = asRecord(payload);
  const event = asString(record.event);
  const hasDemandContent = "briefing" in record || "artes" in record || "artesArray" in record;
  const isStatusEvent = /status/i.test(event) || (!hasDemandContent && "previousStatus" in record);
  if (!isStatusEvent) return null;

  const externalId = asString(record.id);
  const status = asString(record.status);
  if (!externalId || !status) return null;
  return { externalId, status, event: event || null };
}

/**
 * Aplica só o status (e o arquivamento de concluída) na demanda de arte ou de
 * vídeo com esse `external_id` — nunca toca briefing/artes/raw_payload, nem cria
 * demanda nova. Não notifica o WAR de volta (a mudança veio dele).
 */
export async function applyWarStatusEvent(
  supabase: ReturnType<typeof createAdminClient>,
  evt: WarStatusEvent
): Promise<{ table: "creative_demands" | "video_demands"; id: string } | null> {
  const now = new Date().toISOString();
  const done = isDoneStatus(evt.status);
  const update = {
    status: evt.status,
    updated_at: now,
    is_archived: done,
    ...(done ? { completed_at: now } : {}),
  };

  for (const table of ["creative_demands", "video_demands"] as const) {
    const { data, error } = await supabase
      .from(table)
      .update(update)
      .eq("external_id", evt.externalId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return { table, id: data.id };
  }
  return null;
}
