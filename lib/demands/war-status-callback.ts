/**
 * Callback de status para o WAR (a plataforma que origina as demandas).
 *
 * Quando o status de uma demanda muda no CreativeOS, avisamos o WAR chamando o
 * endpoint que ele expõe (`POST /api/webhooks/demandas/status`). A URL e o nome
 * do header de auth vêm do objeto `callback` que o WAR passou a incluir no
 * payload de criação (persistido em `raw_payload`) — sem hardcode. A chave
 * (`DEMANDAS_WEBHOOK_SECRET`) vem do ambiente; nunca trafega no payload.
 */

const CALLBACK_TIMEOUT_MS = 8000;
const DEFAULT_HEADER = "x-api-key";

type WarCallbackTarget = { url: string; header: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Extrai o alvo de callback do WAR a partir do `raw_payload` da criação, com
 * fallback para a env `WAR_STATUS_WEBHOOK_URL` (demandas antigas, criadas antes
 * do WAR passar a mandar o `callback`, ainda conseguem notificar).
 */
export function extractWarCallback(rawPayload: unknown): WarCallbackTarget | null {
  const callback = asRecord(asRecord(rawPayload)?.callback);

  const fromPayload =
    typeof callback?.url === "string" ? callback.url.trim() : "";
  const url = fromPayload || (process.env.WAR_STATUS_WEBHOOK_URL ?? "").trim();
  if (!url) return null;

  const header =
    typeof callback?.header === "string" && callback.header.trim()
      ? callback.header.trim()
      : DEFAULT_HEADER;

  return { url, header };
}

/** Lista de status que o WAR aceita para esta demanda (do payload de criação). */
export function extractStatusPermitidos(rawPayload: unknown): string[] {
  const list = asRecord(rawPayload)?.statusPermitidos;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0
  );
}

/**
 * Monta o valor do header de auth. O WAR aceita `x-api-key: <secret>` ou
 * `Authorization: Bearer <secret>` — se o header pedido for Authorization,
 * usamos o esquema Bearer.
 */
function authHeaderValue(header: string, secret: string): string {
  return header.toLowerCase() === "authorization" ? `Bearer ${secret}` : secret;
}

/**
 * Notifica o WAR sobre a mudança de status. Best-effort: nunca lança — loga e
 * segue, para não derrubar a ação de UI se o WAR estiver indisponível (o status
 * já foi persistido no CreativeOS antes de chamar aqui).
 */
export async function notifyWarStatusChange(params: {
  externalId: string | null | undefined;
  status: string;
  rawPayload: unknown;
  updatedBy?: string;
}): Promise<void> {
  const { externalId, status, rawPayload, updatedBy = "CreativeOS" } = params;
  if (!externalId) return;

  const target = extractWarCallback(rawPayload);
  if (!target) return; // Sem callback no payload nem env configurada.

  const secret = process.env.DEMANDAS_WEBHOOK_SECRET;
  if (!secret) {
    console.warn(
      "[war-status-callback] DEMANDAS_WEBHOOK_SECRET ausente — pulando notificação ao WAR"
    );
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALLBACK_TIMEOUT_MS);

  try {
    const res = await fetch(target.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [target.header]: authHeaderValue(target.header, secret),
      },
      body: JSON.stringify({ id: externalId, status, updatedBy }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[war-status-callback] WAR respondeu ${res.status}: ${text.slice(0, 300)}`
      );
    }
  } catch (err) {
    console.error(
      "[war-status-callback] falha ao notificar WAR:",
      err instanceof Error ? err.message : err
    );
  } finally {
    clearTimeout(timer);
  }
}
