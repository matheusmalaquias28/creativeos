import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { cancelPost, claimPost, publishDuePosts, publishPostNow, verifyUploadedItems } from "../posts";
import { InstagramPublishError } from "../errors";

/**
 * Supabase falso em memória: só o pedaço da API que posts.ts usa. Cada
 * UPDATE aplica os filtros e grava na mesma "transação", como o Postgres faz
 * com `UPDATE … WHERE … RETURNING`.
 */
type Row = Record<string, unknown>;

function fakeAdmin(rows: Row[], files: Record<string, Buffer> = {}) {
  const table = rows.map((r) => ({ ...r }));

  function query(op: "select" | "update" | "insert", payload?: Row) {
    const filters: ((r: Row) => boolean)[] = [];
    let limit = Infinity;
    const run = () => {
      if (op === "insert") {
        const row = { ...payload };
        table.push(row);
        return [row];
      }
      const matched = table.filter((r) => filters.every((f) => f(r))).slice(0, limit);
      if (op === "update") matched.forEach((r) => Object.assign(r, payload));
      return matched.map((r) => ({ ...r }));
    };
    const builder = {
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), builder),
      in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), builder),
      lte: (k: string, v: string) => (filters.push((r) => r[k] != null && String(r[k]) <= v), builder),
      lt: (k: string, v: string) => (filters.push((r) => r[k] != null && String(r[k]) < v), builder),
      order: () => builder,
      limit: (n: number) => ((limit = n), builder),
      select: () => builder,
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      single: async () => {
        const data = run()[0];
        return { data: data ?? null, error: data ? null : { message: "not found" } };
      },
      then: (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: run(), error: null }),
    };
    return builder;
  }

  const admin = {
    from: () => ({
      select: () => query("select"),
      update: (payload: Row) => query("update", payload),
      insert: (payload: Row) => query("insert", payload),
    }),
    storage: {
      from: () => ({
        download: async (path: string) =>
          files[path] ? { data: new Blob([new Uint8Array(files[path])]), error: null } : { data: null, error: { message: "not found" } },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/instagram-posts/${path}` } }),
      }),
    },
  };
  return { admin: admin as never, table };
}

const items = [
  { url: "https://cdn.test/1.jpg", path: "c/p/card-01.jpg" },
  { url: "https://cdn.test/2.jpg", path: "c/p/card-02.jpg" },
];
const basePost = {
  studio_carousel_id: "c",
  client_id: null,
  ig_user_id: "1784",
  ig_username: "conta",
  items,
  caption: "Legenda",
  media_id: null,
  permalink: null,
  error: null,
  publishing_started_at: null,
  published_at: null,
  created_by: "u1",
  created_at: "2026-10-18T10:00:00.000Z",
  updated_at: "2026-10-18T10:00:00.000Z",
};
const credentials = vi.fn(async () => ({ igUserId: "1784", username: "conta", accessToken: "IGAAtest" }));
const publishResult = () => ({ mediaId: "m1", permalink: "https://www.instagram.com/p/X/", containerId: "k", childIds: [] });
const okPublish = vi.fn(async () => publishResult());

describe("claimPost", () => {
  it("só uma de duas chamadas simultâneas reivindica o post", async () => {
    const { admin } = fakeAdmin([{ ...basePost, id: "p1", status: "draft", scheduled_at: null }]);
    const [a, b] = await Promise.all([claimPost(admin, "p1", ["draft"]), claimPost(admin, "p1", ["draft"])]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect((a ?? b)!.status).toBe("publishing");
  });

  it("não reivindica agendado que ainda não venceu", async () => {
    const { admin } = fakeAdmin([{ ...basePost, id: "p1", status: "scheduled", scheduled_at: "2026-10-18T15:00:00.000Z" }]);
    expect(await claimPost(admin, "p1", ["scheduled"], { dueBy: "2026-10-18T14:59:00.000Z" })).toBeNull();
    expect(await claimPost(admin, "p1", ["scheduled"], { dueBy: "2026-10-18T15:00:00.000Z" })).not.toBeNull();
  });
});

describe("publishPostNow", () => {
  it("publica e grava media_id e permalink", async () => {
    const { admin, table } = fakeAdmin([{ ...basePost, id: "p1", status: "draft", scheduled_at: null }]);
    const post = await publishPostNow(admin, "p1", { publish: okPublish, credentials });
    expect(post).toMatchObject({ status: "published", media_id: "m1", permalink: "https://www.instagram.com/p/X/" });
    expect(okPublish).toHaveBeenCalledWith(
      { igUserId: "1784", accessToken: "IGAAtest", imageUrls: ["https://cdn.test/1.jpg", "https://cdn.test/2.jpg"], caption: "Legenda" },
      expect.anything()
    );
    expect(table[0].status).toBe("published");
  });

  it("marca failed com a mensagem e avisa para conferir quando falha no media_publish", async () => {
    const { admin } = fakeAdmin([{ ...basePost, id: "p1", status: "draft", scheduled_at: null }]);
    const publish = vi.fn(async () => {
      throw new InstagramPublishError("Limite atingido.", { step: "publish" });
    });
    const post = await publishPostNow(admin, "p1", { publish, credentials });
    expect(post.status).toBe("failed");
    expect(post.error).toMatch(/^Limite atingido\. Confira no Instagram se o post saiu/);
  });

  it("recusa post já publicado ou cancelado", async () => {
    const { admin } = fakeAdmin([{ ...basePost, id: "p1", status: "published", scheduled_at: null }]);
    await expect(publishPostNow(admin, "p1", { publish: okPublish, credentials })).rejects.toThrow(/já foi publicado/);
  });
});

describe("cancelPost", () => {
  it("cancela agendado e recusa o que já está publicando", async () => {
    const { admin } = fakeAdmin([
      { ...basePost, id: "p1", status: "scheduled", scheduled_at: "2026-10-19T12:00:00.000Z" },
      { ...basePost, id: "p2", status: "publishing", scheduled_at: null },
    ]);
    expect((await cancelPost(admin, "p1")).status).toBe("canceled");
    await expect(cancelPost(admin, "p2")).rejects.toThrow(/Só dá para cancelar/);
  });
});

describe("publishDuePosts (cron)", () => {
  it("publica só os agendados vencidos e marca interrompidos como failed", async () => {
    const { admin, table } = fakeAdmin([
      { ...basePost, id: "due", status: "scheduled", scheduled_at: "2026-10-18T11:55:00.000Z" },
      { ...basePost, id: "future", status: "scheduled", scheduled_at: "2026-10-18T12:30:00.000Z" },
      { ...basePost, id: "canceled", status: "canceled", scheduled_at: "2026-10-18T11:00:00.000Z" },
      { ...basePost, id: "stuck", status: "publishing", scheduled_at: null, publishing_started_at: "2026-10-18T11:00:00.000Z" },
    ]);
    const publish = vi.fn(async () => publishResult());
    const summary = await publishDuePosts(admin, { now: new Date("2026-10-18T12:00:00.000Z"), publish, credentials });

    expect(summary).toMatchObject({ due: 1, published: ["due"], failed: [], stale: 1 });
    expect(publish).toHaveBeenCalledTimes(1);
    const byId = Object.fromEntries(table.map((r) => [r.id, r]));
    expect(byId.due.status).toBe("published");
    expect(byId.future.status).toBe("scheduled");
    expect(byId.canceled.status).toBe("canceled");
    expect(byId.stuck.status).toBe("failed");
    expect(String(byId.stuck.error)).toMatch(/interrompida/);
  });

  it("dois crons ao mesmo tempo não publicam o mesmo post duas vezes", async () => {
    const { admin } = fakeAdmin([{ ...basePost, id: "due", status: "scheduled", scheduled_at: "2026-10-18T11:55:00.000Z" }]);
    const publish = vi.fn(async () => publishResult());
    const now = new Date("2026-10-18T12:00:00.000Z");
    await Promise.all([publishDuePosts(admin, { now, publish, credentials }), publishDuePosts(admin, { now, publish, credentials })]);
    expect(publish).toHaveBeenCalledTimes(1);
  });
});

describe("verifyUploadedItems", () => {
  it("confere caminho, JPEG e proporção e devolve as URLs em ordem", async () => {
    const jpeg = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    const tall = await sharp({ create: { width: 1080, height: 1920, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    const { admin } = fakeAdmin([], { "c/p/card-01.jpg": jpeg, "c/p/card-02.jpg": jpeg, "c/p/card-03.jpg": tall });

    const ok = await verifyUploadedItems(admin, {
      carouselId: "c",
      postId: "p",
      items: [{ path: "c/p/card-02.jpg", page_id: "b" }, { path: "c/p/card-01.jpg", page_id: "a" }],
    });
    expect(ok.map((i) => i.url)).toEqual([
      "https://cdn.test/instagram-posts/c/p/card-02.jpg",
      "https://cdn.test/instagram-posts/c/p/card-01.jpg",
    ]);

    await expect(
      verifyUploadedItems(admin, { carouselId: "c", postId: "p", items: [{ path: "outro/p/card-01.jpg" }, { path: "c/p/card-02.jpg" }] })
    ).rejects.toThrow(/caminho de imagem inválido/);
    await expect(
      verifyUploadedItems(admin, { carouselId: "c", postId: "p", items: [{ path: "c/p/card-01.jpg" }, { path: "c/p/card-03.jpg" }] })
    ).rejects.toThrow(/Card 2: Proporção/);
    await expect(verifyUploadedItems(admin, { carouselId: "c", postId: "p", items: [{ path: "c/p/card-01.jpg" }] })).rejects.toThrow(
      /de 2 a 10 cards/
    );
  });
});
