import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInstagramAdmin } from "@/lib/instagram/http";
import { agentErrorResponse } from "@/lib/carousel-agent/auth";
import { rejectRun } from "@/lib/carousel-agent/decide";

type Params = { params: Promise<{ id: string }> };

/** Reprovação (só admin logado). Body: { feedback?: string } — vai para o agente. */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireInstagramAdmin();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { feedback?: unknown };
  try {
    const run = await rejectRun(createAdminClient(), id, {
      userId: auth.user.id,
      feedback: typeof body.feedback === "string" ? body.feedback : null,
    });
    return NextResponse.json({ run });
  } catch (error) {
    return agentErrorResponse(error, "reprovar");
  }
}
