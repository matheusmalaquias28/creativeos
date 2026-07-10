import { createAdminClient } from "@/lib/supabase/admin";

const TOKEN_ENDPOINT = "https://auth.magnific.com/realms/mcp/protocol/openid-connect/token";
const TOKENS_ROW_ID = 1;
const EXPIRY_MARGIN_MS = 60_000;

export class MagnificNotAuthorizedError extends Error {
  constructor(
    message = 'Magnific não está autorizado. Rode o bootstrap em "/api/admin/magnific/oauth".'
  ) {
    super(message);
    this.name = "MagnificNotAuthorizedError";
  }
}

type RefreshResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
};

/**
 * Retorna um access_token válido do Magnific, renovando via refresh_token quando
 * necessário. Usado pelo conector MCP da API da Anthropic (authorization_token) —
 * não depende mais do cliente MCP bruto (lib/magnific/client.ts, removido).
 */
export async function getValidMagnificAccessToken(): Promise<string> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("magnific_oauth_tokens")
    .select("*")
    .eq("id", TOKENS_ROW_ID)
    .maybeSingle();

  if (!row?.access_token || !row.client_id) {
    throw new MagnificNotAuthorizedError();
  }

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (expiresAt - Date.now() > EXPIRY_MARGIN_MS) {
    return row.access_token;
  }

  if (!row.refresh_token) {
    throw new MagnificNotAuthorizedError("Token expirado e sem refresh_token — reautorize.");
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: row.refresh_token,
    client_id: row.client_id,
  });
  if (row.client_secret) params.set("client_secret", row.client_secret);

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!response.ok) {
    throw new MagnificNotAuthorizedError(
      `Falha ao renovar token do Magnific: HTTP ${response.status}`
    );
  }

  const tokens = (await response.json()) as RefreshResponse;
  const newExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  await supabase
    .from("magnific_oauth_tokens")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? row.refresh_token,
      token_type: tokens.token_type ?? row.token_type,
      scope: tokens.scope ?? row.scope,
      expires_at: newExpiresAt,
    })
    .eq("id", TOKENS_ROW_ID);

  return tokens.access_token;
}
