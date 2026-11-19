import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { requireInstagramAdmin } from "@/lib/instagram/http";
import { InstagramAccountError } from "@/lib/instagram/account";
import { InstagramPostError } from "@/lib/instagram/posts";
import type { User } from "@/types/database";
import { AgentRunError } from "./runs";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** O agente se identifica com `Authorization: Bearer $CAROUSEL_AGENT_SECRET`. */
export function isAgentRequest(request: Request): boolean {
  const secret = process.env.CAROUSEL_AGENT_SECRET?.trim();
  if (!secret) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return !!bearer && safeEqual(bearer, secret);
}

export type Actor = { kind: "agent" } | { kind: "user"; user: User };

/** Agente (segredo) ou admin logado. */
export async function requireAgentOrAdmin(request: Request): Promise<{ actor: Actor } | { response: NextResponse }> {
  if (isAgentRequest(request)) return { actor: { kind: "agent" } };
  if (request.headers.get("authorization")) {
    return { response: NextResponse.json({ error: "Segredo do agente inválido" }, { status: 401 }) };
  }
  const auth = await requireInstagramAdmin();
  if ("response" in auth) return auth;
  return { actor: { kind: "user", user: auth.user } };
}

export function agentErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof AgentRunError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof InstagramPostError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof InstagramAccountError) return NextResponse.json({ error: error.message }, { status: 503 });
  console.error(`[carousel-agent] ${context}`, error);
  return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado" }, { status: 500 });
}
