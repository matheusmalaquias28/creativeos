import { getValidMagnificAccessToken } from "./access-token";

const MAGNIFIC_MCP_URL = "https://mcp.magnific.com";
const PROTOCOL_VERSION = "2025-03-26";

export class MagnificToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MagnificToolError";
  }
}

type JsonRpcResponse = {
  result?: unknown;
  error?: { code?: number; message?: string };
};

type ToolCallResult = {
  content?: { type: string; text?: string }[];
  structuredContent?: unknown;
  isError?: boolean;
};

/**
 * Cliente MCP mínimo (Streamable HTTP / JSON-RPC) para mcp.magnific.com, chamado
 * direto do backend — sem agente Claude no meio (custo zero de tokens; os passos
 * de geração são determinísticos, ver generate-art.ts).
 *
 * Toda resposta é bufferizada por inteiro (res.text()) antes de qualquer parse:
 * corpo não consumido deixa a conexão keep-alive presa no pool do undici e trava
 * a PRÓXIMA requisição pro mesmo host — o mesmo bug do handshake OAuth
 * (ver buffered-fetch.ts e o commit 7d82810).
 */
export class MagnificMcpSession {
  private constructor(
    private readonly token: string,
    private readonly sessionId: string | null
  ) {}

  static async connect(signal?: AbortSignal): Promise<MagnificMcpSession> {
    const token = await getValidMagnificAccessToken();

    const { sessionId, body } = await rawRpc(token, null, "initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "creative-os", version: "1.0.0" },
    }, signal);

    if (body?.error) {
      throw new MagnificToolError(`initialize falhou: ${body.error.message ?? "erro desconhecido"}`);
    }

    const session = new MagnificMcpSession(token, sessionId);
    // Notificação sem resposta esperada — falha aqui não é fatal.
    await rawRpc(token, sessionId, "notifications/initialized", {}, signal).catch(() => {});
    return session;
  }

  /**
   * Chama uma tool e devolve o payload de dados dela: `structuredContent` quando
   * presente; senão o primeiro bloco de texto que parseia como JSON; senão o
   * texto cru concatenado. (O primeiro bloco de texto pode ser um
   * `<system_reminder>` destinado a agentes — nunca assumir que é o dado.)
   */
  async callTool<T = unknown>(
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<T> {
    const { body } = await rawRpc(
      this.token,
      this.sessionId,
      "tools/call",
      { name, arguments: args },
      signal
    );

    if (body?.error) {
      throw new MagnificToolError(`Tool "${name}" falhou: ${body.error.message ?? "erro desconhecido"}`);
    }

    const result = (body?.result ?? {}) as ToolCallResult;
    const textBlocks = (result.content ?? []).filter(
      (block): block is { type: "text"; text: string } =>
        block.type === "text" && typeof block.text === "string"
    );

    if (result.isError) {
      const message = textBlocks.map((b) => b.text).join("\n");
      throw new MagnificToolError(`Tool "${name}" falhou: ${message || "erro desconhecido"}`);
    }

    if (result.structuredContent !== undefined && result.structuredContent !== null) {
      return result.structuredContent as T;
    }

    for (const block of textBlocks) {
      try {
        return JSON.parse(block.text) as T;
      } catch {
        // não era JSON — tenta o próximo bloco
      }
    }

    const joined = textBlocks.map((b) => b.text).join("\n");
    return (joined || result) as unknown as T;
  }
}

async function rawRpc(
  token: string,
  sessionId: string | null,
  method: string,
  params: Record<string, unknown>,
  signal?: AbortSignal
): Promise<{ sessionId: string | null; body: JsonRpcResponse | null }> {
  const t0 = Date.now();
  const res = await fetch(MAGNIFIC_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 1e9),
      method,
      params,
    }),
    signal,
  });

  const newSessionId = res.headers.get("mcp-session-id") ?? sessionId;
  const text = await res.text(); // sempre consumir o corpo inteiro (ver doc da classe)
  console.log(`[magnific/mcp] ${method} status=${res.status} ${Date.now() - t0}ms`);

  if (!res.ok && res.status !== 202) {
    throw new MagnificToolError(
      `MCP ${method}: HTTP ${res.status} — ${text.slice(0, 300)}`
    );
  }

  let body: JsonRpcResponse | null = null;
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    body = JSON.parse(trimmed) as JsonRpcResponse;
  } else if (trimmed.length > 0) {
    // SSE: usa o último evento `data:` (resposta final da chamada)
    const datas = trimmed
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    if (datas.length) body = JSON.parse(datas[datas.length - 1]) as JsonRpcResponse;
  }

  return { sessionId: newSessionId, body };
}
