import { createPrivateKey, createSign } from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const SCOPE = "https://www.googleapis.com/auth/drive";

type DriveFile = {
  id: string;
  name: string;
};

function unwrapQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function decodeMaybeBase64(value: string): string {
  const compact = value.replace(/\s+/g, "");
  if (
    value.includes("BEGIN") ||
    value.trim().startsWith("{") ||
    !/^[A-Za-z0-9+/]+=*$/.test(compact) ||
    compact.length < 80
  ) {
    return value;
  }

  try {
    const decoded = Buffer.from(compact, "base64").toString("utf8");
    if (decoded.includes("BEGIN") || decoded.trim().startsWith("{")) {
      return decoded;
    }
  } catch {
    // keep original
  }
  return value;
}

function parseServiceAccountJson(
  raw: string
): { email?: string; privateKey?: string } | null {
  const text = unwrapQuotes(raw).trim();
  if (!text.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(text) as {
      client_email?: string;
      private_key?: string;
    };
    return {
      email: parsed.client_email,
      privateKey: parsed.private_key,
    };
  } catch {
    return null;
  }
}

function normalizePrivateKey(raw: string): string {
  let key = unwrapQuotes(decodeMaybeBase64(raw))
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();

  const match = key.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (!match) return key;

  const label = match[1];
  const body = match[2].replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g) ?? [body];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

function readServiceAccount(): { email: string; privateKey: string } | null {
  const jsonRaw = process.env.GOOGLE_SA_JSON ?? "";
  const fromJson =
    parseServiceAccountJson(decodeMaybeBase64(unwrapQuotes(jsonRaw))) ??
    parseServiceAccountJson(
      decodeMaybeBase64(unwrapQuotes(process.env.GOOGLE_SA_PRIVATE_KEY ?? ""))
    );

  const email =
    process.env.GOOGLE_SA_EMAIL?.trim() || fromJson?.email?.trim() || "";
  const privateKey = normalizePrivateKey(
    fromJson?.privateKey || process.env.GOOGLE_SA_PRIVATE_KEY || ""
  );

  if (!email || !privateKey.includes("BEGIN")) return null;
  return { email, privateKey };
}

function signJwt(unsigned: string, privateKeyPem: string): Buffer {
  try {
    const keyObject = createPrivateKey({ key: privateKeyPem, format: "pem" });
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    return signer.sign(keyObject);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/DECODER|unsupported|DECODING|PEM|bad decrypt/i.test(message)) {
      throw new Error(
        "GOOGLE_SA_PRIVATE_KEY inválida. No Vercel, cole o JSON inteiro da service account em GOOGLE_SA_JSON (uma linha só) ou a chave PEM numa linha com \\n."
      );
    }
    throw error;
  }
}

export function isGoogleDriveConfigured(): boolean {
  return readServiceAccount() != null;
}

function base64Url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function getAccessToken(): Promise<string> {
  const sa = readServiceAccount();
  if (!sa) {
    throw new Error("Google Drive não configurado. Defina GOOGLE_SA_EMAIL e GOOGLE_SA_PRIVATE_KEY.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: sa.email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${payload}`;
  const jwt = `${unsigned}.${base64Url(signJwt(unsigned, sa.privateKey))}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao autenticar no Google Drive: ${text.slice(0, 240)}`);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Google Drive não retornou access_token");
  }
  return json.access_token;
}

async function driveFetch(
  url: string,
  init: RequestInit & { token: string }
): Promise<Response> {
  const { token, headers, ...rest } = init;
  return fetch(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /429|403|500|502|503|rateLimitExceeded/i.test(message);
      if (!retryable || i === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** i));
    }
  }
  throw lastError;
}

export async function findFileInFolder(
  folderId: string,
  name: string
): Promise<DriveFile | null> {
  const token = await getAccessToken();
  const safeName = name.replace(/'/g, "\\'");
  const q = `name = '${safeName}' and '${folderId}' in parents and trashed = false`;
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1`;

  const res = await driveFetch(url, { token });
  if (!res.ok) {
    throw new Error(`Drive search falhou: ${await res.text()}`);
  }
  const json = (await res.json()) as { files?: DriveFile[] };
  return json.files?.[0] ?? null;
}

export async function findOrCreateFolder(
  parentId: string,
  name: string
): Promise<string> {
  const existing = await findFileInFolder(parentId, name);
  if (existing) return existing.id;

  const token = await getAccessToken();
  const res = await driveFetch(`${DRIVE_API}/files?supportsAllDrives=true`, {
    token,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });

  if (!res.ok) {
    throw new Error(`Não foi possível criar a pasta ${name}: ${await res.text()}`);
  }
  const json = (await res.json()) as DriveFile;
  return json.id;
}

export async function uploadOrReplaceFile(params: {
  folderId: string;
  name: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<string> {
  return withRetry(async () => {
    const existing = await findFileInFolder(params.folderId, params.name);
    const token = await getAccessToken();
    const metadata = existing
      ? { name: params.name }
      : { name: params.name, parents: [params.folderId] };

    const boundary = `creativeos_${Date.now()}`;
    const prefix = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`
    );
    const suffix = Buffer.from(`\r\n--${boundary}--`);
    const body = Buffer.concat([prefix, params.bytes, suffix]);

    const endpoint = existing
      ? `${DRIVE_UPLOAD}/${existing.id}?uploadType=multipart&supportsAllDrives=true`
      : `${DRIVE_UPLOAD}?uploadType=multipart&supportsAllDrives=true`;

    const res = await driveFetch(endpoint, {
      token,
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });

    if (!res.ok) {
      throw new Error(`Upload Drive falhou (${params.name}): ${await res.text()}`);
    }
    const json = (await res.json()) as DriveFile;
    return json.id;
  });
}
