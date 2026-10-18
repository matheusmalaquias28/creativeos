/**
 * Erros da Instagram Graph API traduzidos para mensagens claras em português.
 *
 * A API devolve `{ error: { message, type, code, error_subcode, fbtrace_id } }`.
 * O `error_subcode` (2207xxx) é o que diz o motivo real nas chamadas de
 * publicação; o `code` cobre token, permissão e limite de chamadas.
 */

export type GraphErrorPayload = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
  fbtrace_id?: string;
};

export class InstagramPublishError extends Error {
  readonly code?: number;
  readonly subcode?: number;
  readonly fbtraceId?: string;
  /** Etapa em que falhou — ajuda a ler o log. */
  readonly step: string;

  constructor(message: string, opts: { step: string; code?: number; subcode?: number; fbtraceId?: string; cause?: unknown }) {
    super(message, { cause: opts.cause });
    this.name = "InstagramPublishError";
    this.step = opts.step;
    this.code = opts.code;
    this.subcode = opts.subcode;
    this.fbtraceId = opts.fbtraceId;
  }
}

/** Subcódigos de publicação (Instagram Platform → Error codes). */
const SUBCODE_MESSAGES: Record<number, string> = {
  2207001: "O Instagram teve um erro interno ao processar a mídia. Tente de novo em alguns minutos.",
  2207003: "O Instagram demorou demais para baixar a imagem. Confira se a URL pública responde rápido.",
  2207004: "Imagem grande demais para o Instagram (máx. 8MB).",
  2207005: "Formato de imagem não suportado. O Instagram só aceita JPEG.",
  2207006: "Mídia não encontrada — o container pode ter expirado ou o token não tem acesso a ela.",
  2207008: "O container expirou ou houve uma falha temporária. Gere os containers de novo.",
  2207009: "Proporção não suportada. Imagens do feed precisam ficar entre 4:5 e 1.91:1.",
  2207010: "Legenda longa demais (máx. 2.200 caracteres, 30 hashtags e 20 menções).",
  2207020: "A mídia expirou antes de ser publicada (containers valem 24h).",
  2207027: "A mídia ainda não está pronta para publicar. Espere o status FINISHED.",
  2207028: "Carrossel inválido: precisa ter de 2 a 10 itens.",
  2207032: "O Instagram não conseguiu criar a mídia. Tente de novo.",
  2207042: "Limite de publicações via API atingido nas últimas 24h para esta conta.",
  2207050: "A conta do Instagram está restrita ou inativa. Entre no app e resolva antes de publicar.",
  2207051: "O Instagram bloqueou a ação (suspeita de spam ou automação).",
  2207052: "O Instagram não conseguiu baixar a imagem da URL. Ela precisa ser pública e servir JPEG.",
  2207053: "Falha desconhecida no upload. Gere os containers de novo.",
};

/** Códigos genéricos da Graph API. */
function messageForCode(code: number | undefined, subcode: number | undefined): string | null {
  if (code === 190) {
    return subcode === 463
      ? "O token de acesso do Instagram expirou. Gere um novo no painel da Meta."
      : "Token de acesso do Instagram inválido ou revogado. Gere um novo no painel da Meta.";
  }
  if (code === 10 || (code !== undefined && code >= 200 && code <= 299)) {
    return "O token não tem a permissão de publicação (instagram_business_content_publish ou instagram_content_publish).";
  }
  if (code === 4 || code === 17 || code === 32 || code === 613) {
    return "Limite de chamadas da API do Instagram atingido. Espere alguns minutos e tente de novo.";
  }
  if (code === 100) return null; // parâmetro inválido: a mensagem da API é a mais útil
  return null;
}

export function describeGraphError(error: GraphErrorPayload | undefined, httpStatus?: number): string {
  if (!error) return `Resposta inesperada da API do Instagram${httpStatus ? ` (HTTP ${httpStatus})` : ""}.`;
  const bySubcode = error.error_subcode ? SUBCODE_MESSAGES[error.error_subcode] : undefined;
  const byCode = messageForCode(error.code, error.error_subcode);
  const known = bySubcode ?? byCode;
  const raw = error.error_user_msg || error.message;
  if (known) return raw && raw !== known ? `${known} (Meta: ${raw})` : known;
  return raw ? `Erro da API do Instagram: ${raw}` : "Erro desconhecido da API do Instagram.";
}
