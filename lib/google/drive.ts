import { createSign } from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const SCOPE = "https://www.googleapis.com/auth/drive";

type DriveFile = {
  id: string;
  name: string;
};

function readServiceAccount(): { email: string; privateKey: string } | null {
  const email = process.env.GOOGLE_SA_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!email || !privateKey) return null;
  return { email, privateKey };
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
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const jwt = `${unsigned}.${base64Url(signer.sign(sa.privateKey))}`;

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
