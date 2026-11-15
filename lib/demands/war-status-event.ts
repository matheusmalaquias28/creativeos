import type { createAdminClient } from "@/lib/supabase/admin";
import { isClosedStatus, isDoneStatus } from "@/types/demand";

type UnknownRecord = Record<string, unknown>;

export type WarStatusEvent = { externalId: string; status: string; event: string | null };

/**
 * Evento do WAR que NÃO é criação/edição de demanda (comentário, mudança de
 * status, …). `status` só vem preenchido quando o evento carrega um status.
 */
export type WarDemandEvent = { externalId: string; status: string | null; event: string | null };

/** Eventos de remoção/cancelamento da demanda: encerra a cópia no CreativeOS. */
export function isWarDemandRemovalEvent(event: string | null): boolean {
  return Boolean(event && /remov|exclu|delet|apag|cancel/i.test(event));
}

/** Eventos que nunca podem reescrever o conteúdo da demanda. */
const NON_CONTENT_EVENT = /nota|coment|status|remov|exclu|delet|apag|cancel/i;

/** Campos que só existem num payload de criação/edição (arte ou vídeo). */
function hasDemandContent(record: UnknownRecord): boolean {
  if (
    "briefing" in record ||
    "artes" in record ||
    "artesArray" in record ||
    "briefingDescricao" in record ||
    "briefingTexto" in record
  ) {
    return true;
  }
  return Object.keys(record).some((key) => /^\d+$/.test(key) || key.startsWith("briefing."));
}

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
  const evt = parseWarDemandEvent(payload);
  if (!evt || !evt.status) return null;
  return { externalId: evt.externalId, status: evt.status, event: evt.event };
}

/**
 * Reconhece qualquer evento do WAR que chega no webhook de demandas mas NÃO é
 * criação/edição: comentário (`demanda.nota`), mudança de status
 * (`demanda.status`) ou qualquer `event` sem conteúdo de demanda. Esses
 * payloads trazem só id/cliente/nota — tratados como criação, o upsert apagava
 * artes (a copy), briefing e o `raw_payload` com o `callback`. Para eles, no
 * máximo o status é aplicado; o conteúdo da demanda nunca é tocado.
 * Devolve null para payloads de criação/edição.
 */
export function parseWarDemandEvent(payload: unknown): WarDemandEvent | null {
  const record = asRecord(payload);
  const event = asString(record.event);
  const content = hasDemandContent(record);
  const isEvent =
    NON_CONTENT_EVENT.test(event) || (!content && (Boolean(event) || "previousStatus" in record));
  if (!isEvent) return null;

  const externalId = asString(record.id);
  if (!externalId) return null;
  return { externalId, status: asString(record.status) || null, event: event || null };
}

/**
 * Data de entrega trazida por um evento do WAR. `undefined` quando o evento não
 * fala de data (não mexe); `null` quando o WAR mandou a data vazia (remove).
 */
export function parseWarEventDueDate(payload: unknown): string | null | undefined {
  const record = asRecord(payload);
  if (!("dueDate" in record)) return undefined;
  const raw = asString(record.dueDate);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

/**
 * Aplica só o status (e o arquivamento de concluída) e/ou a data de entrega na
 * demanda de arte ou de vídeo com esse `external_id` — nunca toca
 * briefing/artes/raw_payload, nem cria demanda nova. Não notifica o WAR de
 * volta (a mudança veio dele).
 */
export async function applyWarStatusEvent(
  supabase: ReturnType<typeof createAdminClient>,
  evt: { externalId: string; status: string | null; dueDate?: string | null }
): Promise<{ table: "creative_demands" | "video_demands"; id: string } | null> {
  const now = new Date().toISOString();
  const update: {
    updated_at: string;
    status?: string;
    is_archived?: boolean;
    completed_at?: string;
    due_date?: string | null;
  } = { updated_at: now };
  if (evt.status) {
    const done = isDoneStatus(evt.status);
    const closed = isClosedStatus(evt.status);
    update.status = evt.status;
    update.is_archived = closed;
    if (done) update.completed_at = now;
  }
  if (evt.dueDate !== undefined) update.due_date = evt.dueDate;

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
