import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("../direct-art", () => ({ directArt: vi.fn() }));
import { loadReferenceAssets } from "../prepare";

function database(rows: Record<string, unknown>) {
  return { from: (table: string) => {
    const query = {
      select: () => query, eq: () => query,
      order: async () => ({ data: rows[table], error: null }),
      maybeSingle: async () => ({ data: rows[table], error: null }),
    };
    return query;
  } } as unknown as Parameters<typeof loadReferenceAssets>[0];
}
describe("reference sources for demands", () => {
  it("reuses onboarding and legacy images once while retaining asset roles", async () => {
    const assets = await loadReferenceAssets(database({
      client_reference_asset: [{ id: "product-id", kind: "produto", storage_url: "https://example.com/product", usage_count: 1 }],
      client_creative_profile: { identity_sample_urls: ["https://example.com/style"], style_reference_urls: ["https://example.com/style", "https://example.com/product"] },
      client_references: [{ public_url: "https://example.com/legacy" }],
    }), "client");
    expect(assets.map((a) => a.storageUrl)).toEqual(["https://example.com/product", "https://example.com/style", "https://example.com/legacy"]);
    expect(assets[0].kind).toBe("produto");
    expect(assets[1].id).toMatch(/^inherited:/);
  });
  it("supports a client with no reference library or identity", async () => {
    expect(await loadReferenceAssets(database({ client_reference_asset: [], client_creative_profile: null, client_references: [] }), "new-client")).toEqual([]);
  });
});
