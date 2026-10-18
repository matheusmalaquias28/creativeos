import { describeGraphError, InstagramPublishError, type GraphErrorPayload } from "./errors";

/**
 * Publicação no feed do Instagram via Graph API (Content Publishing).
 *
 * Uma imagem só = post simples: POST /media com image_url + caption, espera
 * FINISHED e publica. Duas ou mais = carrossel (docs da Meta, v25.0):
 *   1. POST /{ig-user-id}/media  image_url + is_carousel_item=true   (1 container por imagem)
 *   2. espera cada container ficar status_code=FINISHED
 *   3. POST /{ig-user-id}/media  media_type=CAROUSEL + children + caption
 *   4. espera o container do carrossel ficar FINISHED
 *   5. POST /{ig-user-id}/media_publish  creation_id=<carrossel>
 *   6. GET  /{media-id}?fields=permalink
 *
 * Funciona com os dois tipos de token: Instagram Login (`IGAA…`, host
 * graph.instagram.com) e Facebook Login (`EAA…`, host graph.facebook.com).
 */

export const INSTAGRAM_API_VERSION = process.env.INSTAGRAM_API_VERSION || "v25.0";

/** Limites da documentação (IG User Media reference). */
export const POST_MIN_ITEMS = 1;
export const CAROUSEL_MIN_ITEMS = 2;
export const CAROUSEL_MAX_ITEMS = 10;
export const CAPTION_MAX_CHARS = 2200;
export const CAPTION_MAX_HASHTAGS = 30;
export const CAPTION_MAX_MENTIONS = 20;

type ContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";

export type PublishCarouselParams = {
  igUserId: string;
  accessToken: string;
  /** URLs públicas de JPEGs, na ordem do carrossel. */
  imageUrls: string[];
  caption?: string | null;
};

export type PublishCarouselOptions = {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Intervalo entre consultas de status_code. */
  pollIntervalMs?: number;
  /** Tempo máximo esperando os containers de uma etapa ficarem FINISHED. */
  containerTimeoutMs?: number;
  /** Sobrescreve o host (por padrão deduzido do token). */
  graphHost?: string;
  onProgress?: (message: string) => void;
};

export type PublishCarouselResult = {
  mediaId: string;
  permalink: string | null;
  containerId: string;
  childIds: string[];
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function graphHostForToken(accessToken: string): string {
  return accessToken.startsWith("EAA") ? "graph.facebook.com" : "graph.instagram.com";
}

/** Valida o que dá para validar antes de gastar chamadas na API. */
export function validateCarouselInput(params: Pick<PublishCarouselParams, "imageUrls" | "caption">): void {
  const { imageUrls } = params;
  if (imageUrls.length < POST_MIN_ITEMS) {
    throw new InstagramPublishError("Escolha pelo menos uma imagem para publicar.", { step: "validate" });
  }
  if (imageUrls.length > CAROUSEL_MAX_ITEMS) {
    throw new InstagramPublishError(
      `A API do Instagram aceita no máximo ${CAROUSEL_MAX_ITEMS} itens por carrossel (este tem ${imageUrls.length}).`,
      { step: "validate" }
    );
  }
  for (const url of imageUrls) {
    if (!/^https:\/\//i.test(url)) {
      throw new InstagramPublishError(`A imagem precisa ter uma URL pública HTTPS: ${url}`, { step: "validate" });
    }
  }
  const caption = params.caption ?? "";
  if (caption.length > CAPTION_MAX_CHARS) {
    throw new InstagramPublishError(
      `Legenda longa demais: ${caption.length} caracteres (máx. ${CAPTION_MAX_CHARS}).`,
      { step: "validate" }
    );
  }
  const hashtags = caption.match(/(^|\s)#[\p{L}\p{N}_]+/gu)?.length ?? 0;
  if (hashtags > CAPTION_MAX_HASHTAGS) {
    throw new InstagramPublishError(`Legenda com ${hashtags} hashtags (máx. ${CAPTION_MAX_HASHTAGS}).`, { step: "validate" });
  }
  const mentions = caption.match(/(^|\s)@[\w.]+/g)?.length ?? 0;
  if (mentions > CAPTION_MAX_MENTIONS) {
    throw new InstagramPublishError(`Legenda com ${mentions} menções (máx. ${CAPTION_MAX_MENTIONS}).`, { step: "validate" });
  }
}

function createGraphClient(accessToken: string, opts: PublishCarouselOptions) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const base = `https://${opts.graphHost ?? graphHostForToken(accessToken)}/${INSTAGRAM_API_VERSION}`;

  async function call<T>(step: string, method: "GET" | "POST", path: string, params: Record<string, string>): Promise<T> {
    const search = new URLSearchParams({ ...params, access_token: accessToken });
    const url = method === "GET" ? `${base}/${path}?${search}` : `${base}/${path}`;
    let res: Response;
    try {
      res = await fetchImpl(url, method === "GET" ? { method } : { method, body: search });
    } catch (cause) {
      throw new InstagramPublishError("Não foi possível conectar à API do Instagram.", { step, cause });
    }
    const json = (await res.json().catch(() => null)) as (T & { error?: GraphErrorPayload }) | null;
    if (!res.ok || !json || json.error) {
      const error = json?.error;
      throw new InstagramPublishError(describeGraphError(error, res.status), {
        step,
        code: error?.code,
        subcode: error?.error_subcode,
        fbtraceId: error?.fbtrace_id,
      });
    }
    return json;
  }

  return { call };
}

type GraphClient = ReturnType<typeof createGraphClient>;

async function waitForContainers(
  graph: GraphClient,
  ids: string[],
  label: string,
  opts: PublishCarouselOptions
): Promise<void> {
  const sleep = opts.sleep ?? defaultSleep;
  const interval = opts.pollIntervalMs ?? 3000;
  const timeout = opts.containerTimeoutMs ?? 120_000;
  const pending = new Set(ids);
  let waited = 0;

  while (true) {
    const statuses = await Promise.all(
      [...pending].map(async (id) => {
        const data = await graph.call<{ status_code?: ContainerStatus; status?: string }>(
          `status:${label}`,
          "GET",
          id,
          { fields: "status_code,status" }
        );
        return { id, ...data };
      })
    );

    for (const s of statuses) {
      if (s.status_code === "FINISHED") pending.delete(s.id);
      else if (s.status_code === "ERROR") {
        throw new InstagramPublishError(
          `O Instagram não conseguiu processar ${label} (container ${s.id})${s.status ? `: ${s.status}` : "."}`,
          { step: `status:${label}` }
        );
      } else if (s.status_code === "EXPIRED") {
        throw new InstagramPublishError(`O container de ${label} expirou (24h sem publicar). Gere de novo.`, {
          step: `status:${label}`,
        });
      } else if (s.status_code === "PUBLISHED") {
        throw new InstagramPublishError(`O container de ${label} já foi publicado antes.`, { step: `status:${label}` });
      }
    }

    if (pending.size === 0) return;
    if (waited >= timeout) {
      throw new InstagramPublishError(
        `Tempo esgotado esperando o Instagram processar ${label} (${Math.round(timeout / 1000)}s). Tente de novo.`,
        { step: `status:${label}` }
      );
    }
    opts.onProgress?.(`Aguardando ${label}: ${pending.size} em processamento…`);
    await sleep(interval);
    waited += interval;
  }
}

export async function publishCarousel(
  params: PublishCarouselParams,
  opts: PublishCarouselOptions = {}
): Promise<PublishCarouselResult> {
  if (!params.igUserId?.trim()) throw new InstagramPublishError("ID da conta do Instagram ausente.", { step: "validate" });
  if (!params.accessToken?.trim()) throw new InstagramPublishError("Token de acesso do Instagram ausente.", { step: "validate" });
  validateCarouselInput(params);

  const graph = createGraphClient(params.accessToken, opts);
  const ig = params.igUserId;

  let containerId: string;
  const childIds: string[] = [];
  if (params.imageUrls.length === 1) {
    // Post de uma imagem: o próprio container leva a legenda.
    opts.onProgress?.("Criando a imagem…");
    const single: Record<string, string> = { image_url: params.imageUrls[0] };
    if (params.caption?.trim()) single.caption = params.caption;
    ({ id: containerId } = await graph.call<{ id: string }>("image", "POST", `${ig}/media`, single));
    await waitForContainers(graph, [containerId], "a imagem", opts);
  } else {
    // 1. Containers dos itens. Em sequência: são no máximo 10 e evita estourar
    //    o limite de chamadas por rajada.
    for (const [i, imageUrl] of params.imageUrls.entries()) {
      opts.onProgress?.(`Criando item ${i + 1}/${params.imageUrls.length}…`);
      const { id } = await graph.call<{ id: string }>(`item:${i + 1}`, "POST", `${ig}/media`, {
        image_url: imageUrl,
        is_carousel_item: "true",
      });
      childIds.push(id);
    }

    // 2. Itens prontos.
    await waitForContainers(graph, childIds, "as imagens do carrossel", opts);

    // 3. Container do carrossel.
    opts.onProgress?.("Criando o carrossel…");
    const carouselParams: Record<string, string> = { media_type: "CAROUSEL", children: childIds.join(",") };
    if (params.caption?.trim()) carouselParams.caption = params.caption;
    ({ id: containerId } = await graph.call<{ id: string }>("carousel", "POST", `${ig}/media`, carouselParams));

    // 4. Carrossel pronto.
    await waitForContainers(graph, [containerId], "o carrossel", opts);
  }

  // 5. Publica.
  opts.onProgress?.("Publicando…");
  const { id: mediaId } = await graph.call<{ id: string }>("publish", "POST", `${ig}/media_publish`, {
    creation_id: containerId,
  });

  // 6. Permalink. Se falhar, a publicação já aconteceu — não derruba o resultado.
  let permalink: string | null = null;
  try {
    const data = await graph.call<{ permalink?: string }>("permalink", "GET", mediaId, { fields: "permalink" });
    permalink = data.permalink ?? null;
  } catch {
    permalink = null;
  }

  return { mediaId, permalink, containerId, childIds };
}

export type InstagramAccount = { igUserId: string; username: string | null };

/**
 * GET graph.instagram.com/me?fields=user_id,username — conta dona do token.
 * Só existe no Instagram Login (`IGAA…`); no Facebook Login o /me é o usuário
 * do Facebook, e o id da conta vem de /me/accounts (ver README).
 */
export async function getInstagramAccount(
  params: Pick<PublishCarouselParams, "accessToken">,
  opts: Pick<PublishCarouselOptions, "fetchImpl" | "graphHost"> = {}
): Promise<InstagramAccount> {
  const host = opts.graphHost ?? graphHostForToken(params.accessToken);
  if (host !== "graph.instagram.com") {
    throw new InstagramPublishError(
      "Com token do Facebook Login (EAA…) o ID da conta não sai do /me: defina INSTAGRAM_TEST_IG_USER_ID (ver lib/instagram/README.md).",
      { step: "account" }
    );
  }
  const graph = createGraphClient(params.accessToken, { ...opts, graphHost: host });
  const me = await graph.call<{ user_id?: string | number; id?: string; username?: string }>("account", "GET", "me", {
    fields: "user_id,username",
  });
  const igUserId = me.user_id != null ? String(me.user_id) : null;
  if (!igUserId) throw new InstagramPublishError("O /me do Instagram não devolveu o user_id da conta.", { step: "account" });
  return { igUserId, username: me.username ?? null };
}

export type PublishingQuota = { used: number; total: number | null };

/** GET /{ig-user-id}/content_publishing_limit — publicações via API nas últimas 24h. */
export async function getPublishingQuota(
  params: Pick<PublishCarouselParams, "igUserId" | "accessToken">,
  opts: Pick<PublishCarouselOptions, "fetchImpl" | "graphHost"> = {}
): Promise<PublishingQuota> {
  const graph = createGraphClient(params.accessToken, opts);
  const res = await graph.call<{ data?: { quota_usage?: number; config?: { quota_total?: number } }[] }>(
    "quota",
    "GET",
    `${params.igUserId}/content_publishing_limit`,
    { fields: "quota_usage,config" }
  );
  const row = res.data?.[0];
  return { used: row?.quota_usage ?? 0, total: row?.config?.quota_total ?? null };
}
