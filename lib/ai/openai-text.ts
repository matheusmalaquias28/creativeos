import { z } from "zod";

/**
 * Texto/visão via OpenAI Responses API (fetch direto, sem SDK — mesmo padrão de
 * `imagegen/openai.ts`). Usado por todo o carrossel (Studio, estilos, turbo,
 * tweet e o editor clássico). Mesma `OPENAI_API_KEY` da geração de imagens.
 */

const OPENAI_API = "https://api.openai.com/v1";

/** Modelo de texto do carrossel. Override: `OPENAI_CAROUSEL_MODEL`. */
export const OPENAI_CAROUSEL_MODEL = process.env.OPENAI_CAROUSEL_MODEL?.trim() || "gpt-5.5";

export class OpenAITextError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null
  ) {
    super(message);
    this.name = "OpenAITextError";
  }
}

export type OpenAIInputPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail?: "auto" | "low" | "high" };

export const inputText = (text: string): OpenAIInputPart => ({ type: "input_text", text });
export const inputImage = (url: string): OpenAIInputPart => ({ type: "input_image", image_url: url });

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

type JsonFormat = { name: string; schema: Record<string, unknown>; strict: boolean };

export type OpenAITextRequest = {
  model?: string;
  /** Instruções de sistema. */
  system: string;
  /** Mensagem do usuário: texto puro ou partes (texto + imagens por URL). */
  input: string | OpenAIInputPart[];
  maxOutputTokens?: number;
  reasoningEffort?: ReasoningEffort;
  /** Ferramentas nativas da OpenAI (ex.: `{ type: "web_search" }`). */
  tools?: Record<string, unknown>[];
  timeoutMs?: number;
};

type ResponseOutputItem = {
  type: string;
  content?: { type: string; text?: string; refusal?: string }[];
};

export type OpenAIResponse = {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  error?: { message?: string } | null;
  output?: ResponseOutputItem[];
};

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new OpenAITextError("OPENAI_API_KEY não configurada");
  return key;
}

function requestBody(req: OpenAITextRequest, format: JsonFormat | null, stream: boolean) {
  const content = typeof req.input === "string" ? [inputText(req.input)] : req.input;
  return {
    model: req.model ?? OPENAI_CAROUSEL_MODEL,
    instructions: req.system,
    input: [{ role: "user", content }],
    max_output_tokens: req.maxOutputTokens ?? 8000,
    reasoning: { effort: req.reasoningEffort ?? "medium", ...(stream ? { summary: "auto" } : {}) },
    ...(req.tools?.length ? { tools: req.tools } : {}),
    ...(format ? { text: { format: { type: "json_schema", ...format } } } : {}),
    ...(stream ? { stream: true } : {}),
    store: false,
  };
}

async function post(body: unknown, timeoutMs: number): Promise<Response> {
  const res = await fetch(`${OPENAI_API}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let message = detail;
    try {
      message = (JSON.parse(detail) as { error?: { message?: string } }).error?.message ?? detail;
    } catch {
      /* corpo não-JSON */
    }
    throw new OpenAITextError(`OpenAI ${res.status}: ${message.slice(0, 500)}`, res.status);
  }
  return res;
}

/** Texto final da resposta; erro claro para recusa, corte por limite ou falha. */
export function responseText(response: OpenAIResponse): string {
  if (response.status === "failed") {
    throw new OpenAITextError(response.error?.message ?? "A OpenAI não concluiu a resposta");
  }
  if (response.status === "incomplete") {
    const reason = response.incomplete_details?.reason ?? "desconhecido";
    throw new OpenAITextError(`Resposta incompleta da OpenAI (${reason})`);
  }
  const parts = (response.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? []);
  const refusal = parts.find((p) => p.type === "refusal");
  if (refusal) throw new OpenAITextError(`A IA recusou: ${refusal.refusal ?? ""}`.trim());
  const text = parts
    .filter((p) => p.type === "output_text")
    .map((p) => p.text ?? "")
    .join("");
  if (!text.trim()) throw new OpenAITextError("A OpenAI não devolveu texto");
  return text;
}

/** Resposta em texto livre. */
export async function openaiText(req: OpenAITextRequest): Promise<string> {
  const res = await post(requestBody(req, null, false), req.timeoutMs ?? 60_000);
  return responseText((await res.json()) as OpenAIResponse);
}

/** Resposta num JSON Schema cru (sem validação além do que o schema garante). */
export async function openaiJson<T>(
  req: OpenAITextRequest & { schemaName: string; jsonSchema: Record<string, unknown>; strict?: boolean }
): Promise<T> {
  const format = { name: req.schemaName, schema: req.jsonSchema, strict: req.strict ?? true };
  const res = await post(requestBody(req, format, false), req.timeoutMs ?? 120_000);
  return JSON.parse(responseText((await res.json()) as OpenAIResponse)) as T;
}

/** Resposta estruturada num schema zod (strict) e validada por ele. */
export async function openaiStructured<S extends z.ZodType>(
  req: OpenAITextRequest & { schemaName: string; schema: S }
): Promise<z.infer<S>> {
  const jsonSchema = z.toJSONSchema(req.schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  const raw = await openaiJson<unknown>({ ...req, jsonSchema, strict: true });
  return req.schema.parse(raw);
}

export type OpenAIStreamEvent = { type: string; delta?: string; response?: OpenAIResponse };

/**
 * Mesma requisição em streaming (SSE da OpenAI). `onEvent` recebe cada evento
 * (ex.: `response.reasoning_summary_text.delta`, `response.web_search_call.searching`)
 * e a função devolve a resposta final de `response.completed`.
 */
export async function openaiJsonStream(
  req: OpenAITextRequest & { schemaName: string; jsonSchema: Record<string, unknown>; strict?: boolean },
  onEvent: (event: OpenAIStreamEvent) => void
): Promise<OpenAIResponse> {
  const format = { name: req.schemaName, schema: req.jsonSchema, strict: req.strict ?? true };
  const res = await post(requestBody(req, format, true), req.timeoutMs ?? 120_000);
  if (!res.body) throw new OpenAITextError("Streaming sem corpo");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: OpenAIResponse | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const data = chunk
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");
      if (!data || data === "[DONE]") continue;
      const event = JSON.parse(data) as OpenAIStreamEvent & { message?: string };
      if (event.type === "error") throw new OpenAITextError(event.message ?? "Erro no streaming da OpenAI");
      if (
        event.response &&
        (event.type === "response.completed" ||
          event.type === "response.incomplete" ||
          event.type === "response.failed")
      ) {
        final = event.response;
      }
      onEvent(event);
    }
  }
  if (!final) throw new OpenAITextError("Streaming terminou sem resposta final");
  return final;
}
