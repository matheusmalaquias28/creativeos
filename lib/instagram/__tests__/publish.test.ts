import { describe, expect, it, vi } from "vitest";
import { getPublishingQuota, graphHostForToken, publishCarousel } from "../publish";
import { InstagramPublishError } from "../errors";

/**
 * Graph API falsa: responde por método + caminho e guarda as chamadas.
 * `statuses` define a sequência de status_code devolvida para cada container.
 */
function fakeGraph(opts: {
  statuses?: Record<string, string[]>;
  failOn?: { method: string; path: RegExp; error: Record<string, unknown>; status?: number };
  permalink?: string;
}) {
  const calls: { method: string; path: string; params: URLSearchParams }[] = [];
  let childSeq = 0;
  const statusCursor = new Map<string, number>();

  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const params = method === "GET" ? url.searchParams : new URLSearchParams(String(init?.body ?? ""));
    const path = url.pathname.replace(/^\/v[\d.]+\//, "");
    calls.push({ method, path, params });

    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

    if (opts.failOn && opts.failOn.method === method && opts.failOn.path.test(path)) {
      return json({ error: opts.failOn.error }, opts.failOn.status ?? 400);
    }
    if (method === "POST" && path.endsWith("/media")) {
      if (params.get("media_type") === "CAROUSEL") return json({ id: "carousel-1" });
      childSeq += 1;
      return json({ id: `child-${childSeq}` });
    }
    if (method === "POST" && path.endsWith("/media_publish")) return json({ id: "media-99" });
    if (method === "GET" && params.get("fields") === "status_code,status") {
      const seq = opts.statuses?.[path] ?? ["FINISHED"];
      const i = statusCursor.get(path) ?? 0;
      statusCursor.set(path, i + 1);
      return json({ status_code: seq[Math.min(i, seq.length - 1)], status: "detalhe da Meta" });
    }
    if (method === "GET" && params.get("fields") === "permalink") {
      return json({ permalink: opts.permalink ?? "https://www.instagram.com/p/ABC123/" });
    }
    if (method === "GET" && path.endsWith("/content_publishing_limit")) {
      return json({ data: [{ quota_usage: 3, config: { quota_total: 100, quota_duration: 86400 } }] });
    }
    return json({ error: { message: `rota não mockada: ${method} ${path}` } }, 404);
  });

  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

const base = {
  igUserId: "1784",
  accessToken: "IGAAtest",
  imageUrls: ["https://cdn.test/1.jpg", "https://cdn.test/2.jpg", "https://cdn.test/3.jpg"],
  caption: "Legenda #teste",
};
const noSleep = () => Promise.resolve();

describe("publishCarousel", () => {
  it("cria os itens, espera FINISHED, cria o carrossel, publica e devolve o permalink", async () => {
    const { fetchImpl, calls } = fakeGraph({
      statuses: { "child-2": ["IN_PROGRESS", "IN_PROGRESS", "FINISHED"], "carousel-1": ["IN_PROGRESS", "FINISHED"] },
    });
    const sleep = vi.fn(noSleep);

    const result = await publishCarousel(base, { fetchImpl, sleep, pollIntervalMs: 10 });

    expect(result).toEqual({
      mediaId: "media-99",
      permalink: "https://www.instagram.com/p/ABC123/",
      containerId: "carousel-1",
      childIds: ["child-1", "child-2", "child-3"],
    });

    const items = calls.filter((c) => c.method === "POST" && c.path === "1784/media" && c.params.get("is_carousel_item"));
    expect(items.map((c) => c.params.get("image_url"))).toEqual(base.imageUrls);
    expect(items.every((c) => c.params.get("is_carousel_item") === "true")).toBe(true);
    // Item do carrossel não leva legenda.
    expect(items.every((c) => !c.params.has("caption"))).toBe(true);

    const carousel = calls.find((c) => c.params.get("media_type") === "CAROUSEL")!;
    expect(carousel.params.get("children")).toBe("child-1,child-2,child-3");
    expect(carousel.params.get("caption")).toBe("Legenda #teste");

    const publish = calls.find((c) => c.path === "1784/media_publish")!;
    expect(publish.params.get("creation_id")).toBe("carousel-1");
    expect(publish.params.get("access_token")).toBe("IGAAtest");

    // child-2 precisou de 2 esperas e o carrossel de 1.
    expect(sleep).toHaveBeenCalledTimes(3);
    // O carrossel só é criado depois de todos os itens FINISHED.
    const carouselIdx = calls.indexOf(carousel);
    const lastChildPoll = calls.map((c, i) => (c.path === "child-2" ? i : -1)).filter((i) => i >= 0).pop()!;
    expect(lastChildPoll).toBeLessThan(carouselIdx);
  });

  it("usa graph.instagram.com para token do Instagram Login e graph.facebook.com para token do Facebook", async () => {
    expect(graphHostForToken("IGAAxyz")).toBe("graph.instagram.com");
    expect(graphHostForToken("EAAxyz")).toBe("graph.facebook.com");

    const { fetchImpl } = fakeGraph({});
    await publishCarousel({ ...base, accessToken: "EAAfb" }, { fetchImpl, sleep: noSleep });
    const firstUrl = String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(firstUrl).toMatch(/^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/1784\/media$/);
  });

  it("falha com mensagem clara quando um container fica ERROR", async () => {
    const { fetchImpl, calls } = fakeGraph({ statuses: { "child-1": ["IN_PROGRESS", "ERROR"] } });
    await expect(publishCarousel(base, { fetchImpl, sleep: noSleep })).rejects.toThrow(
      /não conseguiu processar as imagens do carrossel \(container child-1\): detalhe da Meta/
    );
    expect(calls.some((c) => c.path.endsWith("/media_publish"))).toBe(false);
  });

  it("estoura o tempo se o container não fica pronto", async () => {
    const { fetchImpl } = fakeGraph({ statuses: { "carousel-1": ["IN_PROGRESS"] } });
    const err = await publishCarousel(base, { fetchImpl, sleep: noSleep, pollIntervalMs: 1000, containerTimeoutMs: 3000 }).catch(
      (e) => e
    );
    expect(err).toBeInstanceOf(InstagramPublishError);
    expect(err.message).toMatch(/Tempo esgotado esperando o Instagram processar o carrossel \(3s\)/);
  });

  it("traduz token expirado (190/463)", async () => {
    const { fetchImpl } = fakeGraph({
      failOn: {
        method: "POST",
        path: /\/media$/,
        status: 400,
        error: { message: "Error validating access token", type: "OAuthException", code: 190, error_subcode: 463, fbtrace_id: "trace1" },
      },
    });
    const err = await publishCarousel(base, { fetchImpl, sleep: noSleep }).catch((e) => e);
    expect(err).toBeInstanceOf(InstagramPublishError);
    expect(err.message).toMatch(/^O token de acesso do Instagram expirou/);
    expect(err).toMatchObject({ code: 190, subcode: 463, fbtraceId: "trace1", step: "item:1" });
  });

  it("traduz limite diário de publicações (2207042) no media_publish", async () => {
    const { fetchImpl } = fakeGraph({
      failOn: {
        method: "POST",
        path: /\/media_publish$/,
        error: { message: "Application request limit reached", code: 9, error_subcode: 2207042 },
      },
    });
    await expect(publishCarousel(base, { fetchImpl, sleep: noSleep })).rejects.toThrow(
      /Limite de publicações via API atingido nas últimas 24h/
    );
  });

  it("não derruba a publicação se o permalink falhar", async () => {
    const { fetchImpl } = fakeGraph({
      failOn: { method: "GET", path: /^media-99$/, error: { message: "boom", code: 1 } },
    });
    const result = await publishCarousel(base, { fetchImpl, sleep: noSleep });
    expect(result.mediaId).toBe("media-99");
    expect(result.permalink).toBeNull();
  });

  it("valida a entrada antes de chamar a API", async () => {
    const { fetchImpl, calls } = fakeGraph({});
    const run = (over: Partial<typeof base>) => publishCarousel({ ...base, ...over }, { fetchImpl, sleep: noSleep });

    await expect(run({ imageUrls: ["https://cdn.test/1.jpg"] })).rejects.toThrow(/pelo menos 2 imagens/);
    await expect(run({ imageUrls: Array.from({ length: 11 }, (_, i) => `https://cdn.test/${i}.jpg`) })).rejects.toThrow(
      /no máximo 10 itens/
    );
    await expect(run({ imageUrls: ["http://cdn.test/1.jpg", "https://cdn.test/2.jpg"] })).rejects.toThrow(/HTTPS/);
    await expect(run({ caption: "a".repeat(2201) })).rejects.toThrow(/Legenda longa demais/);
    await expect(run({ caption: Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(" ") })).rejects.toThrow(/31 hashtags/);
    await expect(run({ accessToken: " " })).rejects.toThrow(/Token de acesso do Instagram ausente/);
    expect(calls).toHaveLength(0);
  });
});

describe("getPublishingQuota", () => {
  it("lê quota_usage e quota_total", async () => {
    const { fetchImpl, calls } = fakeGraph({});
    await expect(getPublishingQuota({ igUserId: "1784", accessToken: "IGAAtest" }, { fetchImpl })).resolves.toEqual({
      used: 3,
      total: 100,
    });
    expect(calls[0].path).toBe("1784/content_publishing_limit");
  });
});
