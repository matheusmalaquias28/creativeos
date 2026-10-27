import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { credentialsForPost, InstagramAccountError, listAccounts, resetAccountCache, resolveAccount } from "../account";

/** /me falso: cada token IGAA responde com a conta do mapa (ou 401). */
function fakeMe(byToken: Record<string, { user_id: string; username: string }>) {
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const me = byToken[url.searchParams.get("access_token") ?? ""];
    if (!me) {
      return new Response(JSON.stringify({ error: { message: "Invalid OAuth access token", code: 190 } }), { status: 401 });
    }
    return new Response(JSON.stringify(me), { status: 200, headers: { "content-type": "application/json" } });
  });
  return fetchImpl as unknown as typeof fetch;
}

const ENV_KEYS = [
  "INSTAGRAM_ACCESS_TOKEN",
  "INSTAGRAM_TEST_ACCESS_TOKEN",
  "INSTAGRAM_TEST_IG_USER_ID",
  "INSTAGRAM_ACCESS_TOKEN_2",
  "INSTAGRAM_IG_USER_ID_2",
  "INSTAGRAM_ACCESS_TOKEN_3",
  "INSTAGRAM_IG_USER_ID_3",
];

describe("contas do Instagram no env", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    resetAccountCache();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.restoreAllMocks();
  });

  it("lista a conta principal e as extras, na ordem", async () => {
    process.env.INSTAGRAM_ACCESS_TOKEN = "IGAAum";
    process.env.INSTAGRAM_ACCESS_TOKEN_2 = "IGAAdois";
    process.env.INSTAGRAM_IG_USER_ID_2 = "17841454458724946";
    const fetchImpl = fakeMe({
      IGAAum: { user_id: "1784001", username: "principal" },
      IGAAdois: { user_id: "17841454458724946", username: "segunda" },
    });
    const accounts = await listAccounts({ fetchImpl });
    expect(accounts.map((a) => a.username)).toEqual(["principal", "segunda"]);
    await expect(resolveAccount("17841454458724946", { fetchImpl })).resolves.toMatchObject({ accessToken: "IGAAdois" });
    await expect(credentialsForPost({ ig_user_id: "1784001", client_id: null }, { fetchImpl })).resolves.toMatchObject({
      accessToken: "IGAAum",
    });
  });

  it("token EAA usa o id do env sem chamar o /me", async () => {
    process.env.INSTAGRAM_ACCESS_TOKEN_2 = "EAAtoken";
    process.env.INSTAGRAM_IG_USER_ID_2 = "17841454458724946";
    const fetchImpl = fakeMe({});
    await expect(listAccounts({ fetchImpl })).resolves.toEqual([
      { igUserId: "17841454458724946", username: null, accessToken: "EAAtoken" },
    ]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("conta com problema fica de fora sem derrubar as outras", async () => {
    process.env.INSTAGRAM_ACCESS_TOKEN = "IGAAum";
    process.env.INSTAGRAM_ACCESS_TOKEN_2 = "IGAAvencido";
    process.env.INSTAGRAM_ACCESS_TOKEN_3 = "IGAAdois";
    process.env.INSTAGRAM_IG_USER_ID_3 = "999"; // não bate com o /me
    const fetchImpl = fakeMe({
      IGAAum: { user_id: "1784001", username: "principal" },
      IGAAdois: { user_id: "1784002", username: "segunda" },
    });
    const accounts = await listAccounts({ fetchImpl });
    expect(accounts.map((a) => a.igUserId)).toEqual(["1784001"]);
    await expect(resolveAccount("1784002", { fetchImpl })).rejects.toBeInstanceOf(InstagramAccountError);
  });

  it("sem nenhuma conta, erro claro", async () => {
    await expect(listAccounts({ fetchImpl: fakeMe({}) })).rejects.toThrow(/INSTAGRAM_ACCESS_TOKEN/);
  });
});
