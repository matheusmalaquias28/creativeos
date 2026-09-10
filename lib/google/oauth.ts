import { createAdminClient } from "@/lib/supabase/admin";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const ROW_ID = 1;

export type GoogleDriveConnection = {
  connected: boolean;
  email: string | null;
  oauthAppConfigured: boolean;
};

export function isGoogleOAuthAppConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  );
}

export function getGoogleOAuthRedirectUri(origin: string): string {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${origin.replace(/\/$/, "")}/api/google/drive/oauth/callback`;
}

function oauthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Falta GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET. Crie um OAuth Client (Web) no Google Cloud."
    );
  }
  return { clientId, clientSecret };
}

export function buildGoogleAuthUrl(params: {
  origin: string;
  state: string;
}): string {
  const { clientId } = oauthClient();
  const redirectUri = getGoogleOAuthRedirectUri(params.origin);
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DRIVE_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", params.state);
  return url.toString();
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export async function exchangeGoogleAuthCode(params: {
  code: string;
  origin: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresAt: string }> {
  const { clientId, clientSecret } = oauthClient();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getGoogleOAuthRedirectUri(params.origin),
    }),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new Error(
      json.error_description ||
        json.error ||
        "Google não devolveu refresh_token. Revogue o acesso em myaccount.google.com/permissions e conecte de novo."
    );
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(),
  };
}

export async function saveGoogleDriveConnection(params: {
  refreshToken: string;
  accessToken: string;
  expiresAt: string;
  email: string;
  connectedBy: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("google_drive_oauth_tokens").upsert(
    {
      id: ROW_ID,
      refresh_token: params.refreshToken,
      access_token: params.accessToken,
      expires_at: params.expiresAt,
      google_email: params.email,
      connected_by: params.connectedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(error.message);
}

export async function deleteGoogleDriveConnection(): Promise<void> {
  const admin = createAdminClient();
  await admin.from("google_drive_oauth_tokens").delete().eq("id", ROW_ID);
}

export async function getGoogleDriveConnection(): Promise<GoogleDriveConnection> {
  const oauthAppConfigured = isGoogleOAuthAppConfigured();

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("google_drive_oauth_tokens")
      .select("google_email, refresh_token")
      .eq("id", ROW_ID)
      .maybeSingle();
    return {
      connected: Boolean(data?.refresh_token),
      email: data?.google_email ?? null,
      oauthAppConfigured,
    };
  } catch {
    return {
      connected: false,
      email: null,
      oauthAppConfigured,
    };
  }
}

export async function getOAuthAccessToken(): Promise<string | null> {
  const { clientId, clientSecret } = (() => {
    try {
      return oauthClient();
    } catch {
      return { clientId: "", clientSecret: "" };
    }
  })();
  if (!clientId || !clientSecret) return null;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("google_drive_oauth_tokens")
    .select("refresh_token, access_token, expires_at")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (!row?.refresh_token) return null;

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (row.access_token && expiresAt > Date.now() + 60_000) {
    return row.access_token;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description ||
        "Sessão do Google Drive expirou. Conecte a conta de novo."
    );
  }

  const nextExpiry = new Date(
    Date.now() + (json.expires_in ?? 3600) * 1000
  ).toISOString();
  await admin
    .from("google_drive_oauth_tokens")
    .update({
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? row.refresh_token,
      expires_at: nextExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ROW_ID);

  return json.access_token;
}

export async function fetchGoogleAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return "conta Google";
  const json = (await res.json()) as {
    user?: { emailAddress?: string };
  };
  return json.user?.emailAddress ?? "conta Google";
}
