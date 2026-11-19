import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInstagramAdmin } from "@/lib/instagram/http";
import { agentErrorResponse } from "@/lib/carousel-agent/auth";
import { approveRun } from "@/lib/carousel-agent/decide";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/**
 * Aprovação (só admin logado; o agente não aprova o próprio carrossel).
 * Body: { scheduledAt: ISO } para agendar, ou { scheduledAt: null } para publicar agora.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireInstagramAdmin();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  let body: { scheduledAt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body precisa ser JSON" }, { status: 400 });
  }
  const scheduledAt = typeof body.scheduledAt === "string" && body.scheduledAt ? body.scheduledAt : null;

  try {
    const { run, post } = await approveRun(createAdminClient(), id, { userId: auth.user.id, scheduledAt });
    return NextResponse.json({ run, post });
  } catch (error) {
    return agentErrorResponse(error, "aprovar");
  }
}
