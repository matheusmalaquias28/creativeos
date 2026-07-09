import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { MagnificOAuthProvider } from "./oauth-provider";

const MAGNIFIC_MCP_URL = "https://mcp.magnific.com";

export class MagnificNotAuthorizedError extends Error {
  constructor(
    message = 'Magnific não está autorizado. Rode o bootstrap em "/api/admin/magnific/oauth".'
  ) {
    super(message);
    this.name = "MagnificNotAuthorizedError";
  }
}

let clientPromise: Promise<Client> | null = null;

async function connectClient(): Promise<Client> {
  const client = new Client({ name: "creative-os", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MAGNIFIC_MCP_URL), {
    authProvider: new MagnificOAuthProvider(),
  });

  try {
    await client.connect(transport);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw new MagnificNotAuthorizedError();
    }
    throw error;
  }

  return client;
}

/** Singleton assíncrono — espelha o formato de lib/ai/client.ts. */
export async function getMagnificClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = connectClient().catch((error: unknown) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

// Tipo mínimo do que consumimos do retorno de callTool — o tipo completo exportado pelo SDK
// não resolve corretamente através do await de getMagnificClient() (perde a shape e vira {}).
type ToolCallResult = {
  content?: { type: string; text?: string }[];
  isError?: boolean;
};

export async function callMagnificTool<T = unknown>(
  name: string,
  args: Record<string, unknown>
): Promise<T> {
  const client = await getMagnificClient();
  const result = (await client.callTool({ name, arguments: args })) as ToolCallResult;

  const textBlocks = (result.content ?? []).filter(
    (block): block is { type: "text"; text: string } =>
      block.type === "text" && typeof block.text === "string"
  );

  if (result.isError) {
    const message = textBlocks.map((block) => block.text).join("\n");
    throw new Error(`Magnific tool "${name}" falhou: ${message || "erro desconhecido"}`);
  }

  const [firstText] = textBlocks;
  if (!firstText) return result as unknown as T;

  try {
    return JSON.parse(firstText.text) as T;
  } catch {
    return firstText.text as unknown as T;
  }
}
