import { createHash } from "crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type UnknownRecord = Record<string, unknown>;

/** Comentário de demanda enviado pelo WAR (evento `demanda.nota`). */
export type WarComment = {
  externalDemandId: string;
  author: string | null;
  body: string;
  images: string[];
  createdAt: string | null;
  raw: unknown;
};

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value != null ? String(value).trim() : "";
}

function toImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : asString(asRecord(item).url)))
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url))
    .slice(0, 20);
}

/**
 * Extrai o comentário de um payload do WAR. Formato atual:
 * `{ id, event: "demanda.nota", nota: { autor, texto, imagens }, addedBy, createdAt }`.
 * Também aceita `nota` como string e `comentario`/`comment` como alias. Devolve
 * null quando o payload não é comentário (ou não tem texto nem imagem).
 */
export function parseWarComment(payload: unknown): WarComment | null {
  const record = asRecord(payload);
  const event = asString(record.event);
  const rawNote = record.nota ?? record.comentario ?? record.comment;
  const isComment = /nota|coment|comment/i.test(event) || rawNote !== undefined;
  if (!isComment) return null;

  const externalDemandId = asString(record.id);
  if (!externalDemandId) return null;

  const note = typeof rawNote === "string" ? { texto: rawNote } : asRecord(rawNote);
  const body = asString(note.texto ?? note.text ?? note.mensagem ?? note.conteudo);
  const images = toImageUrls(note.imagens ?? note.images ?? record.imagens);
  if (!body && images.length === 0) return null;

  const author = asString(note.autor ?? note.author ?? record.addedBy ?? record.updatedBy) || null;
  const createdAtRaw = asString(note.createdAt ?? record.createdAt);
  const createdAtMs = createdAtRaw ? Date.parse(createdAtRaw) : NaN;

  return {
    externalDemandId,
    author,
    body,
    images,
    createdAt: Number.isNaN(createdAtMs) ? null : new Date(createdAtMs).toISOString(),
    raw: payload,
  };
}

/** Chave estável para não duplicar o mesmo comentário se o WAR reenviar. */
export function commentDedupeKey(comment: WarComment): string {
  return createHash("sha1")
    .update(
      [comment.externalDemandId, comment.createdAt ?? "", comment.author ?? "", comment.body, ...comment.images].join(
        "\u0000"
      )
    )
    .digest("hex");
}

/**
 * Grava o comentário ligado à demanda de arte ou de vídeo com esse
 * `external_id`. Idempotente (dedupe_key). Devolve onde ficou vinculado.
 */
export async function saveWarComment(
  supabase: ReturnType<typeof createAdminClient>,
  comment: WarComment
): Promise<{ demandId: string | null; videoDemandId: string | null }> {
  const [{ data: demand }, { data: video }] = await Promise.all([
    supabase.from("creative_demands").select("id").eq("external_id", comment.externalDemandId).maybeSingle(),
    supabase.from("video_demands").select("id").eq("external_id", comment.externalDemandId).maybeSingle(),
  ]);

  const row = {
    external_demand_id: comment.externalDemandId,
    demand_id: demand?.id ?? null,
    video_demand_id: video?.id ?? null,
    source: "war",
    author: comment.author,
    body: comment.body,
    images: comment.images as unknown as Json,
    external_created_at: comment.createdAt,
    dedupe_key: commentDedupeKey(comment),
    raw_payload: (comment.raw ?? {}) as Json,
  };

  const { error } = await supabase
    .from("demand_comments")
    .upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) throw new Error(error.message);

  return { demandId: row.demand_id, videoDemandId: row.video_demand_id };
}

/**
 * Comentários que chegaram antes da demanda existir no CreativeOS ficam sem
 * vínculo; ao criar/atualizar a demanda, liga-os a ela. Best-effort.
 */
export async function linkOrphanWarComments(
  supabase: ReturnType<typeof createAdminClient>,
  target: { kind: "arte" | "video"; id: string; externalId: string }
): Promise<void> {
  const column = target.kind === "arte" ? "demand_id" : "video_demand_id";
  const patch = target.kind === "arte" ? { demand_id: target.id } : { video_demand_id: target.id };
  const { error } = await supabase
    .from("demand_comments")
    .update(patch)
    .eq("external_demand_id", target.externalId)
    .is(column, null);
  if (error) console.error("[war-comment] vínculo de comentários órfãos falhou:", error.message);
}
