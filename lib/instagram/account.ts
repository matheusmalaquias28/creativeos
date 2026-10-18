import type { InstagramAccountInfo } from "@/types/instagram";
import { InstagramPublishError } from "./errors";
import { getInstagramAccount, graphHostForToken } from "./publish";

/**
 * De qual conta do Instagram publicar.
 *
 * Hoje existe uma conta só, a do env (INSTAGRAM_ACCESS_TOKEN, com
 * INSTAGRAM_TEST_ACCESS_TOKEN como nome alternativo, + INSTAGRAM_TEST_IG_USER_ID).
 * Quando cada cliente conectar a própria conta (OAuth), estas duas funções
 * passam a ler a tabela de contas conectadas pelo `clientId`; o resto do
 * fluxo (posts, rotas, cron) não muda, porque cada post grava o `ig_user_id`.
 */

export type InstagramCredentials = InstagramAccountInfo & { accessToken: string };

export class InstagramAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstagramAccountError";
  }
}

function envToken(): string | null {
  return (process.env.INSTAGRAM_ACCESS_TOKEN || process.env.INSTAGRAM_TEST_ACCESS_TOKEN)?.trim() || null;
}

let cache: { token: string; account: InstagramCredentials; at: number } | null = null;
const CACHE_MS = 10 * 60_000;

/** Conta usada para publicar o carrossel deste cliente. */
export async function resolveAccountForClient(
  clientId: string | null,
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<InstagramCredentials> {
  void clientId; // próxima etapa: conta conectada do cliente
  const accessToken = envToken();
  if (!accessToken) throw new InstagramAccountError("Nenhuma conta do Instagram conectada (configure INSTAGRAM_ACCESS_TOKEN).");
  const envIgUserId = process.env.INSTAGRAM_TEST_IG_USER_ID?.trim() || null;

  if (graphHostForToken(accessToken) !== "graph.instagram.com") {
    if (!envIgUserId) {
      throw new InstagramAccountError("Com token do Facebook Login (EAA…), defina também INSTAGRAM_TEST_IG_USER_ID.");
    }
    return { igUserId: envIgUserId, username: null, accessToken };
  }

  if (cache && cache.token === accessToken && Date.now() - cache.at < CACHE_MS) return cache.account;
  let me: InstagramAccountInfo;
  try {
    me = await getInstagramAccount({ accessToken }, opts);
  } catch (e) {
    throw new InstagramAccountError(e instanceof InstagramPublishError ? e.message : "Não foi possível ler a conta do Instagram.");
  }
  if (envIgUserId && envIgUserId !== me.igUserId) {
    throw new InstagramAccountError(
      `INSTAGRAM_TEST_IG_USER_ID (${envIgUserId}) não é a conta do token (@${me.username ?? "?"}, ${me.igUserId}).`
    );
  }
  const account = { ...me, accessToken };
  cache = { token: accessToken, account, at: Date.now() };
  return account;
}

/** Credenciais da conta gravada no post (na hora de publicar, inclusive pelo cron). */
export async function credentialsForPost(
  post: { ig_user_id: string; client_id: string | null },
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<InstagramCredentials> {
  const account = await resolveAccountForClient(post.client_id, opts);
  if (account.igUserId !== post.ig_user_id) {
    throw new InstagramAccountError(
      `O post foi preparado para a conta ${post.ig_user_id}, mas a conta conectada agora é @${account.username ?? account.igUserId}.`
    );
  }
  return account;
}

/** Só para testes. */
export function resetAccountCache() {
  cache = null;
}
