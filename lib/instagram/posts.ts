import { createAdminClient } from "@/lib/supabase/admin";
import {
  INSTAGRAM_POST_STATUSES,
  type InstagramPost,
  type InstagramPostItem,
  type InstagramPostStatus,
} from "@/types/instagram";
import type { Database, Json } from "@/types/database";
import { credentialsForPost, type InstagramCredentials } from "./account";
import { InstagramPublishError } from "./errors";
import { checkInstagramJpeg } from "./jpeg";
import { CAROUSEL_MAX_ITEMS, CAROUSEL_MIN_ITEMS, publishCarousel, validateCarouselInput } from "./publish";

/**
 * Posts do Instagram (tabela `instagram_posts`).
 *
 * Regra de ouro: só publica quem consegue trocar o status para `publishing`
 * num UPDATE condicional (`… WHERE id = ? AND status IN (…)`). Duas chamadas
 * ao mesmo tempo (dois cliques, cron + botão, dois crons) disputam a mesma
 * linha e só uma recebe a linha de volta — a outra não publica.
 */

export const INSTAGRAM_POSTS_BUCKET = "instagram-posts";
/** `publishing` há mais tempo que isso = execução morreu no meio. */
export const STALE_PUBLISHING_MS = 15 * 60_000;

type Admin = ReturnType<typeof createAdminClient>;
type Row = Database["public"]["Tables"]["instagram_posts"]["Row"];

export function toInstagramPost(row: Row): InstagramPost {
  const items = Array.isArray(row.items) ? (row.items as unknown as InstagramPostItem[]) : [];
  const status = (INSTAGRAM_POST_STATUSES as readonly string[]).includes(row.status)
    ? (row.status as InstagramPostStatus)
    : "draft";
  return { ...row, items, status };
}

/** Pasta das imagens de um post: `<carouselId>/<postId>/`. */
export function postFolder(carouselId: string, postId: string): string {
  return `${carouselId}/${postId}`;
}

export function cardPath(carouselId: string, postId: string, index: number): string {
  return `${postFolder(carouselId, postId)}/card-${String(index + 1).padStart(2, "0")}.jpg`;
}

// ─── Criação ─────────────────────────────────────────────────────────────────

export class InstagramPostError extends Error {
  constructor(
    message: string,
    readonly status = 422
  ) {
    super(message);
    this.name = "InstagramPostError";
  }
}

/**
 * Confere os cards que o navegador subiu (caminho esperado, JPEG, proporção)
 * e devolve os itens com a URL pública, na ordem.
 */
export async function verifyUploadedItems(
  admin: Admin,
  params: { carouselId: string; postId: string; items: { path: string; page_id?: string | null }[] }
): Promise<InstagramPostItem[]> {
  const { carouselId, postId, items } = params;
  if (items.length < CAROUSEL_MIN_ITEMS || items.length > CAROUSEL_MAX_ITEMS) {
    throw new InstagramPostError(`Escolha de ${CAROUSEL_MIN_ITEMS} a ${CAROUSEL_MAX_ITEMS} cards (vieram ${items.length}).`);
  }
  const prefix = `${postFolder(carouselId, postId)}/`;
  const seen = new Set<string>();
  const out: InstagramPostItem[] = [];
  for (const [i, item] of items.entries()) {
    if (!item.path.startsWith(prefix) || item.path.includes("..") || seen.has(item.path)) {
      throw new InstagramPostError(`Card ${i + 1}: caminho de imagem inválido.`, 400);
    }
    seen.add(item.path);
    const { data, error } = await admin.storage.from(INSTAGRAM_POSTS_BUCKET).download(item.path);
    if (error || !data) throw new InstagramPostError(`Card ${i + 1}: a imagem não chegou ao Storage. Tente de novo.`);
    try {
      await checkInstagramJpeg(Buffer.from(await data.arrayBuffer()));
    } catch (e) {
      throw new InstagramPostError(`Card ${i + 1}: ${e instanceof Error ? e.message : "imagem inválida"}`);
    }
    const url = admin.storage.from(INSTAGRAM_POSTS_BUCKET).getPublicUrl(item.path).data.publicUrl;
    out.push({ url, path: item.path, page_id: item.page_id ?? null });
  }
  return out;
}

export async function createPost(
  admin: Admin,
  input: {
    id: string;
    carouselId: string;
    clientId: string | null;
    account: Pick<InstagramCredentials, "igUserId" | "username">;
    items: InstagramPostItem[];
    caption: string;
    scheduledAt: string | null;
    createdBy: string;
  }
): Promise<InstagramPost> {
  try {
    validateCarouselInput({ imageUrls: input.items.map((i) => i.url), caption: input.caption });
  } catch (e) {
    throw new InstagramPostError(e instanceof Error ? e.message : "Post inválido");
  }
  const { data, error } = await admin
    .from("instagram_posts")
    .insert({
      id: input.id,
      studio_carousel_id: input.carouselId,
      client_id: input.clientId,
      ig_user_id: input.account.igUserId,
      ig_username: input.account.username,
      items: input.items as unknown as Json,
      caption: input.caption,
      scheduled_at: input.scheduledAt,
      // Agora = rascunho que já sai publicando logo em seguida.
      status: input.scheduledAt ? "scheduled" : "draft",
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error || !data) throw new InstagramPostError(error?.message ?? "Não foi possível salvar o post", 500);
  return toInstagramPost(data);
}

// ─── Publicação ──────────────────────────────────────────────────────────────

/** Troca atômica para `publishing`. Devolve null se outra execução chegou antes. */
export async function claimPost(
  admin: Admin,
  id: string,
  from: InstagramPostStatus[],
  opts: { dueBy?: string } = {}
): Promise<InstagramPost | null> {
  let query = admin
    .from("instagram_posts")
    .update({ status: "publishing", publishing_started_at: new Date().toISOString(), error: null })
    .eq("id", id)
    .in("status", from);
  if (opts.dueBy) query = query.lte("scheduled_at", opts.dueBy);
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw new InstagramPostError(error.message, 500);
  return data ? toInstagramPost(data) : null;
}

export type PublishDeps = {
  publish?: typeof publishCarousel;
  credentials?: typeof credentialsForPost;
};

function failureMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : "Falha desconhecida ao publicar";
  // Falha no próprio media_publish: pode ter saído mesmo assim (ex.: rede caiu
  // na resposta). Avisa antes de alguém tentar de novo e duplicar o post.
  if (e instanceof InstagramPublishError && e.step === "publish") {
    return `${message} Confira no Instagram se o post saiu antes de tentar de novo.`;
  }
  return message;
}

/** Publica um post que esta execução já reivindicou (status `publishing`). */
export async function publishClaimedPost(admin: Admin, post: InstagramPost, deps: PublishDeps = {}): Promise<InstagramPost> {
  const publish = deps.publish ?? publishCarousel;
  const credentials = deps.credentials ?? credentialsForPost;
  let update: Database["public"]["Tables"]["instagram_posts"]["Update"];
  try {
    const account = await credentials(post);
    const result = await publish(
      { igUserId: account.igUserId, accessToken: account.accessToken, imageUrls: post.items.map((i) => i.url), caption: post.caption },
      { onProgress: (m) => console.log(`[instagram] post ${post.id}: ${m}`) }
    );
    update = {
      status: "published",
      media_id: result.mediaId,
      permalink: result.permalink,
      published_at: new Date().toISOString(),
      error: null,
    };
    console.log(`[instagram] post ${post.id} publicado: ${result.mediaId} ${result.permalink ?? ""}`);
  } catch (e) {
    console.error(`[instagram] post ${post.id} falhou`, e);
    update = { status: "failed", error: failureMessage(e) };
  }
  const { data, error } = await admin.from("instagram_posts").update(update).eq("id", post.id).select("*").single();
  if (error || !data) {
    // O post pode ter saído; a linha fica em `publishing` e o cron a marca como interrompida.
    throw new InstagramPostError(`Publicado, mas não foi possível gravar o resultado: ${error?.message ?? "sem resposta"}`, 500);
  }
  return toInstagramPost(data);
}

/** Botão "Publicar agora" (post novo) ou "Tentar de novo" (post que falhou). */
export async function publishPostNow(admin: Admin, id: string, deps: PublishDeps = {}): Promise<InstagramPost> {
  const claimed = await claimPost(admin, id, ["draft", "scheduled", "failed"]);
  if (!claimed) throw new InstagramPostError("Este post já está sendo publicado, já foi publicado ou foi cancelado.", 409);
  return publishClaimedPost(admin, claimed, deps);
}

export async function cancelPost(admin: Admin, id: string): Promise<InstagramPost> {
  const { data, error } = await admin
    .from("instagram_posts")
    .update({ status: "canceled" })
    .eq("id", id)
    .in("status", ["scheduled", "draft", "failed"])
    .select("*")
    .maybeSingle();
  if (error) throw new InstagramPostError(error.message, 500);
  if (!data) throw new InstagramPostError("Só dá para cancelar um post agendado (ele já está publicando ou foi publicado).", 409);
  return toInstagramPost(data);
}

export type CronSummary = { due: number; published: string[]; failed: string[]; skipped: string[]; stale: number };

/** Cron: publica os agendados vencidos, um de cada vez. */
export async function publishDuePosts(
  admin: Admin,
  opts: { now?: Date; limit?: number } & PublishDeps = {}
): Promise<CronSummary> {
  const now = (opts.now ?? new Date()).toISOString();
  const summary: CronSummary = { due: 0, published: [], failed: [], skipped: [], stale: 0 };

  // Execução que morreu no meio: não tenta de novo sozinha (pode ter saído).
  const staleBefore = new Date(Date.parse(now) - STALE_PUBLISHING_MS).toISOString();
  const { data: stale } = await admin
    .from("instagram_posts")
    .update({
      status: "failed",
      error: "A publicação foi interrompida no meio. Confira no Instagram se o post saiu antes de tentar de novo.",
    })
    .eq("status", "publishing")
    .lt("publishing_started_at", staleBefore)
    .select("id");
  summary.stale = stale?.length ?? 0;

  const { data: due, error } = await admin
    .from("instagram_posts")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(opts.limit ?? 3);
  if (error) throw new InstagramPostError(error.message, 500);
  summary.due = due?.length ?? 0;

  for (const { id } of due ?? []) {
    const claimed = await claimPost(admin, id, ["scheduled"], { dueBy: now });
    if (!claimed) {
      summary.skipped.push(id);
      continue;
    }
    const result = await publishClaimedPost(admin, claimed, opts);
    (result.status === "published" ? summary.published : summary.failed).push(id);
  }
  return summary;
}
