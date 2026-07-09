import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationFull,
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

const TOKENS_ROW_ID = 1;

type TokensRow = Database["public"]["Tables"]["magnific_oauth_tokens"]["Row"];

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

/**
 * Provider OAuth do MCP do Magnific, com persistência no Supabase em vez de memória —
 * necessário porque o bootstrap (authorize → callback) e toda chamada headless depois
 * disso acontecem em invocações serverless separadas, sem estado compartilhado.
 *
 * `onRedirect` só é passado pela rota de bootstrap (/api/admin/magnific/oauth); fora
 * dela, cair em `redirectToAuthorization` significa que a conta nunca foi autorizada
 * ou o refresh token morreu.
 */
export class MagnificOAuthProvider implements OAuthClientProvider {
  constructor(private readonly onRedirect?: (url: URL) => void) {}

  get redirectUrl(): string {
    return requiredEnv("MAGNIFIC_OAUTH_REDIRECT_URL");
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl],
      client_name: "CreativeOS",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }

  private async getRow(): Promise<TokensRow | null> {
    const t0 = Date.now();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("magnific_oauth_tokens")
      .select("*")
      .eq("id", TOKENS_ROW_ID)
      .maybeSingle();
    console.log(`[magnific/oauth-provider] getRow ${Date.now() - t0}ms`, error?.message ?? "ok");
    return data;
  }

  private async upsertRow(patch: Partial<TokensRow>): Promise<void> {
    const t0 = Date.now();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("magnific_oauth_tokens")
      .upsert({ id: TOKENS_ROW_ID, ...patch }, { onConflict: "id" });
    console.log(`[magnific/oauth-provider] upsertRow ${Date.now() - t0}ms`, error?.message ?? "ok");
    if (error) {
      throw new Error(`Falha ao salvar credenciais do Magnific: ${error.message}`);
    }
  }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    const row = await this.getRow();
    if (!row?.client_id) return undefined;
    return { client_id: row.client_id, client_secret: row.client_secret ?? undefined };
  }

  async saveClientInformation(info: OAuthClientInformationFull): Promise<void> {
    await this.upsertRow({
      client_id: info.client_id,
      client_secret: info.client_secret ?? null,
    });
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const row = await this.getRow();
    if (!row?.access_token || !row.token_type) return undefined;

    const expiresIn = row.expires_at
      ? Math.max(0, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000))
      : undefined;

    return {
      access_token: row.access_token,
      token_type: row.token_type,
      refresh_token: row.refresh_token ?? undefined,
      scope: row.scope ?? undefined,
      expires_in: expiresIn,
    };
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    const row = await this.getRow();
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // O servidor pode não devolver refresh_token no refresh — mantém o anterior.
    await this.upsertRow({
      access_token: tokens.access_token,
      token_type: tokens.token_type,
      scope: tokens.scope ?? row?.scope ?? null,
      refresh_token: tokens.refresh_token ?? row?.refresh_token ?? null,
      expires_at: expiresAt,
    });
  }

  redirectToAuthorization(authorizationUrl: URL): void {
    if (!this.onRedirect) {
      throw new Error(
        "Magnific não está autorizado. Rode o bootstrap em /api/admin/magnific/oauth."
      );
    }
    this.onRedirect(authorizationUrl);
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await this.upsertRow({ code_verifier: codeVerifier });
  }

  async codeVerifier(): Promise<string> {
    const row = await this.getRow();
    if (!row?.code_verifier) {
      throw new Error("Nenhum code_verifier salvo — reinicie o fluxo de autorização.");
    }
    return row.code_verifier;
  }

  async invalidateCredentials(
    scope: "all" | "client" | "tokens" | "verifier" | "discovery"
  ): Promise<void> {
    if (scope === "all") {
      await this.upsertRow({
        client_id: null,
        client_secret: null,
        access_token: null,
        refresh_token: null,
        token_type: null,
        scope: null,
        expires_at: null,
        code_verifier: null,
        state: null,
      });
    } else if (scope === "client") {
      await this.upsertRow({ client_id: null, client_secret: null });
    } else if (scope === "tokens") {
      await this.upsertRow({
        access_token: null,
        refresh_token: null,
        token_type: null,
        expires_at: null,
      });
    } else if (scope === "verifier") {
      await this.upsertRow({ code_verifier: null });
    }
    // "discovery": não fazemos cache de discovery state, nada a invalidar.
  }
}
