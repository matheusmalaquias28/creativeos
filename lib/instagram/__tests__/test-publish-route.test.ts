import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserProfile = vi.fn();
const prepareStudioCarouselImages = vi.fn();

vi.mock("@/services/users", () => ({ getCurrentUserProfile: () => getCurrentUserProfile() }));
vi.mock("@/lib/instagram/studio-images", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../studio-images")>();
  return { ...actual, prepareStudioCarouselImages: (id: string) => prepareStudioCarouselImages(id) };
});

const { POST } = await import("@/app/api/instagram/test-publish/route");
const { StudioImagesError } = await import("../studio-images");

const CAROUSEL_ID = "6f1c1f2e-2b7a-4c55-9a43-0d2a3e9b8c11";

function request(body: unknown) {
  return new Request("http://localhost/api/instagram/test-publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Graph API mínima: /me, cota, containers sempre FINISHED, publish e permalink. */
function stubGraph() {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (url.pathname.endsWith("/me")) return ok({ user_id: "1784", username: "conta_teste", id: "app-scoped" });
    if (url.pathname.endsWith("/content_publishing_limit")) return ok({ data: [{ quota_usage: 0, config: { quota_total: 100 } }] });
    if (init?.method === "POST" && url.pathname.endsWith("/media_publish")) return ok({ id: "media-1" });
    if (init?.method === "POST" && url.pathname.endsWith("/media")) return ok({ id: `c-${Math.random()}` });
    if (url.searchParams.get("fields") === "permalink") return ok({ permalink: "https://www.instagram.com/p/X/" });
    return ok({ status_code: "FINISHED" });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("POST /api/instagram/test-publish", () => {
  beforeEach(() => {
    vi.stubEnv("INSTAGRAM_TEST_IG_USER_ID", "1784");
    vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "IGAAtest");
    vi.stubEnv("INSTAGRAM_TEST_ACCESS_TOKEN", "");
    getCurrentUserProfile.mockResolvedValue({ id: "u1", role: "admin" });
    prepareStudioCarouselImages.mockResolvedValue({
      carousel: { id: CAROUSEL_ID, caption: "Legenda do studio" },
      imageUrls: ["https://cdn.test/1.jpg", "https://cdn.test/2.jpg"],
      warnings: [],
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("recusa quem não é admin", async () => {
    getCurrentUserProfile.mockResolvedValue({ id: "u2", role: "carousel_creator" });
    const res = await POST(request({ carouselId: CAROUSEL_ID }));
    expect(res.status).toBe(403);
    expect(prepareStudioCarouselImages).not.toHaveBeenCalled();
  });

  it("exige o token no env", async () => {
    vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "");
    const res = await POST(request({ carouselId: CAROUSEL_ID }));
    expect(res.status).toBe(503);
  });

  it("aceita INSTAGRAM_TEST_ACCESS_TOKEN como alternativa", async () => {
    const fetchMock = stubGraph();
    vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "");
    vi.stubEnv("INSTAGRAM_TEST_ACCESS_TOKEN", "IGAAantigo");
    const res = await POST(request({ carouselId: CAROUSEL_ID, dryRun: true }));
    expect(res.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toContain("access_token=IGAAantigo");
  });

  it("sem INSTAGRAM_TEST_IG_USER_ID, usa o user_id do /me (Instagram Login)", async () => {
    const fetchMock = stubGraph();
    vi.stubEnv("INSTAGRAM_TEST_IG_USER_ID", "");
    const res = await POST(request({ carouselId: CAROUSEL_ID, dryRun: true }));
    expect(res.status).toBe(200);
    expect((await res.json()).account).toEqual({ igUserId: "1784", username: "conta_teste" });
    const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input)));
    expect(urls[0].host).toBe("graph.instagram.com");
    expect(urls[0].pathname).toMatch(/\/me$/);
    expect(urls[1].pathname).toMatch(/\/1784\/content_publishing_limit$/);
  });

  it("recusa INSTAGRAM_TEST_IG_USER_ID de outra conta", async () => {
    stubGraph();
    vi.stubEnv("INSTAGRAM_TEST_IG_USER_ID", "999");
    const res = await POST(request({ carouselId: CAROUSEL_ID, dryRun: true }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/não é a conta do token \(@conta_teste, 1784\)/);
  });

  it("token do Facebook Login exige INSTAGRAM_TEST_IG_USER_ID", async () => {
    vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "EAAfb");
    vi.stubEnv("INSTAGRAM_TEST_IG_USER_ID", "");
    const res = await POST(request({ carouselId: CAROUSEL_ID }));
    expect(res.status).toBe(503);
  });

  it("valida o carouselId", async () => {
    const res = await POST(request({ carouselId: "nope" }));
    expect(res.status).toBe(400);
  });

  it("devolve o erro do Studio (ex.: 9:16) com o status certo", async () => {
    stubGraph();
    prepareStudioCarouselImages.mockRejectedValue(new StudioImagesError("Carrossel em 9:16 não pode ser publicado", 422));
    const res = await POST(request({ carouselId: CAROUSEL_ID }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/9:16/);
  });

  it("dryRun prepara as imagens e não publica", async () => {
    const fetchMock = stubGraph();
    const res = await POST(request({ carouselId: CAROUSEL_ID, dryRun: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ dryRun: true, caption: "Legenda do studio", quota: { used: 0, total: 100 } });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("publica e devolve mediaId + permalink", async () => {
    stubGraph();
    const res = await POST(request({ carouselId: CAROUSEL_ID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ mediaId: "media-1", permalink: "https://www.instagram.com/p/X/" });
  });
});
