import type { InstagramAccountInfo } from "@/types/instagram";
import { InstagramPublishError } from "./errors";
import { getInstagramAccount, graphHostForToken } from "./publish";

/**
 * Contas do Instagram em que o sistema publica. Ficam no env:
 *
 * - conta 1: INSTAGRAM_ACCESS_TOKEN (ou INSTAGRAM_TEST_ACCESS_TOKEN) + INSTAGRAM_TEST_IG_USER_ID;
 * - contas extras: INSTAGRAM_ACCESS_TOKEN_2 + INSTAGRAM_IG_USER_ID_2, _3, _4…
 *
 * O diálogo lista as contas e quem publica escolhe o destino. Cada post grava
 * o `ig_user_id`, e na hora de publicar (inclusive pelo cron) o token sai da
 * conta com esse id.
 */

export type InstagramCredentials = InstagramAccountInfo & { accessToken: string };

export class InstagramAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstagramAccountError";
  }
}

type EnvAccount = { label: string; tokenVar: string; idVar: string; accessToken: string; igUserId: string | null };

function envAccounts(): EnvAccount[] {
  const env = process.env;
  const out: EnvAccount[] = [];
  const first = (env.INSTAGRAM_ACCESS_TOKEN || env.INSTAGRAM_TEST_ACCESS_TOKEN)?.trim();
  if (first) {
    out.push({
      label: "1",
      tokenVar: "INSTAGRAM_ACCESS_TOKEN",
      idVar: "INSTAGRAM_TEST_IG_USER_ID",
      accessToken: first,
      igUserId: env.INSTAGRAM_TEST_IG_USER_ID?.trim() || null,
    });
  }
  const extras = Object.keys(env)
    .map((key) => /^INSTAGRAM_ACCESS_TOKEN_(\d+)$/.exec(key)?.[1])
    .filter((n): n is string => Boolean(n))
    .sort((a, b) => Number(a) - Number(b));
  for (const n of extras) {
    const accessToken = env[`INSTAGRAM_ACCESS_TOKEN_${n}`]?.trim();
    if (!accessToken) continue;
    out.push({
      label: n,
      tokenVar: `INSTAGRAM_ACCESS_TOKEN_${n}`,
      idVar: `INSTAGRAM_IG_USER_ID_${n}`,
      accessToken,
      igUserId: env[`INSTAGRAM_IG_USER_ID_${n}`]?.trim() || null,
    });
  }
  return out;
}

const cache = new Map<string, { account: InstagramCredentials; at: number }>();
const CACHE_MS = 10 * 60_000;

async function resolveEnvAccount(entry: EnvAccount, opts: { fetchImpl?: typeof fetch }): Promise<InstagramCredentials> {
  const { accessToken, igUserId } = entry;
  if (graphHostForToken(accessToken) !== "graph.instagram.com") {
    if (!igUserId) {
      throw new InstagramAccountError(`Com token do Facebook Login (EAA…) em ${entry.tokenVar}, defina também ${entry.idVar}.`);
    }
    return { igUserId, username: null, accessToken };
  }

  const hit = cache.get(accessToken);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.account;
  let me: InstagramAccountInfo;
  try {
    me = await getInstagramAccount({ accessToken }, opts);
  } catch (e) {
    const reason = e instanceof InstagramPublishError ? e.message : "Não foi possível ler a conta do Instagram.";
    throw new InstagramAccountError(`Conta ${entry.label} (${entry.tokenVar}): ${reason}`);
  }
  if (igUserId && igUserId !== me.igUserId) {
    throw new InstagramAccountError(`${entry.idVar} (${igUserId}) não é a conta do token (@${me.username ?? "?"}, ${me.igUserId}).`);
  }
  const account = { ...me, accessToken };
  cache.set(accessToken, { account, at: Date.now() });
  return account;
}

/**
 * Todas as contas configuradas, na ordem do env. Uma conta com problema (token
 * vencido, id errado) fica de fora e é logada; só dá erro se nenhuma funcionar.
 */
export async function listAccounts(opts: { fetchImpl?: typeof fetch } = {}): Promise<InstagramCredentials[]> {
  const entries = envAccounts();
  if (!entries.length) throw new InstagramAccountError("Nenhuma conta do Instagram conectada (configure INSTAGRAM_ACCESS_TOKEN).");
  const results = await Promise.allSettled(entries.map((entry) => resolveEnvAccount(entry, opts)));
  const accounts: InstagramCredentials[] = [];
  const errors: unknown[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      if (!accounts.some((a) => a.igUserId === r.value.igUserId)) accounts.push(r.value);
    } else {
      errors.push(r.reason);
      console.error("[instagram] conta indisponível:", r.reason instanceof Error ? r.reason.message : r.reason);
    }
  }
  if (!accounts.length) throw errors[0] instanceof InstagramAccountError ? errors[0] : new InstagramAccountError("Nenhuma conta do Instagram disponível.");
  return accounts;
}

/** Credenciais da conta escolhida (pelo id). */
export async function resolveAccount(igUserId: string, opts: { fetchImpl?: typeof fetch } = {}): Promise<InstagramCredentials> {
  const accounts = await listAccounts(opts);
  const account = accounts.find((a) => a.igUserId === igUserId);
  if (!account) {
    throw new InstagramAccountError(`A conta ${igUserId} não está conectada (ou o token dela está com problema). Confira as variáveis INSTAGRAM_* do servidor.`);
  }
  return account;
}

/** Credenciais da conta gravada no post (na hora de publicar, inclusive pelo cron). */
export async function credentialsForPost(
  post: { ig_user_id: string; client_id: string | null },
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<InstagramCredentials> {
  return resolveAccount(post.ig_user_id, opts);
}

/** Só para testes. */
export function resetAccountCache() {
  cache.clear();
}
