import { getAnthropicClient } from "@/lib/ai/client";
import { getValidMagnificAccessToken } from "./access-token";
import type Anthropic from "@anthropic-ai/sdk";

const MAGNIFIC_MCP_URL = "https://mcp.magnific.com";
const MCP_BETA = "mcp-client-2025-11-20";
const AGENT_MODEL = "claude-opus-4-8";
const MAX_TURNS = 4;

const SPACE_RESULT_SCHEMA = {
  type: "object",
  properties: {
    spaceId: { type: "string" },
    spaceUrl: { type: "string" },
  },
  required: ["spaceId", "spaceUrl"],
  additionalProperties: false,
} as const;

export type SpaceAgentResult = { spaceId: string; spaceUrl: string };

/**
 * Delega a criação/edição do Space inteiramente para um agente Claude com o conector
 * MCP da Anthropic conectado ao servidor do Magnific — a própria Anthropic conversa
 * com mcp.magnific.com (via authorization_token), então chamadas de tool sequenciais
 * ao mesmo host não passam pela rede do Vercel. Substitui o cliente MCP manual
 * (lib/magnific/client.ts, removido) e evita depender dos nomes exatos de campo que
 * cada tool do Magnific devolve — quem interpreta isso é o próprio Claude.
 */
export async function runMagnificSpaceAgent(prompt: string): Promise<SpaceAgentResult> {
  const client = getAnthropicClient();
  const accessToken = await getValidMagnificAccessToken();

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.beta.messages.create({
      model: AGENT_MODEL,
      max_tokens: 8000,
      betas: [MCP_BETA],
      mcp_servers: [
        {
          type: "url",
          url: MAGNIFIC_MCP_URL,
          name: "magnific",
          authorization_token: accessToken,
        },
      ],
      tools: [{ type: "mcp_toolset", mcp_server_name: "magnific" }],
      output_config: { format: { type: "json_schema", schema: SPACE_RESULT_SCHEMA } },
      messages,
    });

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    if (response.stop_reason === "refusal") {
      throw new Error("O agente recusou a solicitação (stop_reason: refusal).");
    }

    const textBlock = response.content.find(
      (block): block is Anthropic.Beta.BetaTextBlock => block.type === "text"
    );
    if (!textBlock) {
      throw new Error(
        `Resposta do agente não trouxe texto final (stop_reason: ${response.stop_reason}).`
      );
    }

    try {
      return JSON.parse(textBlock.text) as SpaceAgentResult;
    } catch {
      throw new Error(`Resposta do agente não é JSON válido: ${textBlock.text.slice(0, 300)}`);
    }
  }

  throw new Error("Agente do Magnific não terminou após várias rodadas (pause_turn repetido).");
}
