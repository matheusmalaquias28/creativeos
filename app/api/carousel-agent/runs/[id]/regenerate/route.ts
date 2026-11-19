import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgentOrAdmin } from "@/lib/carousel-agent/auth";
import { getRun } from "@/lib/carousel-agent/runs";
import { isStale, runGeneration } from "@/lib/carousel-agent/pipeline";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/**
 * Refazer um card ({ cardIndex, instruction? }) ou retomar a geração parada /
 * que falhou (sem cardIndex: gera só os cards que não ficaram prontos).
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireAgentOrAdmin(request);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { cardIndex?: unknown; instruction?: unknown };

  const admin = createAdminClient();
  const run = await getRun(admin, id);
  if (!run) return NextResponse.json({ error: "Carrossel não encontrado" }, { status: 404 });
  if (run.status === "approved" || run.status === "rejected") {
    return NextResponse.json({ error: "Este carrossel já foi decidido." }, { status: 409 });
  }
  if (run.status === "generating" && !isStale(run)) {
    return NextResponse.json({ error: "A geração ainda está rodando." }, { status: 409 });
  }

  const index = typeof body.cardIndex === "number" && Number.isInteger(body.cardIndex) ? body.cardIndex : null;
  if (index !== null && (index < 0 || index >= run.cards.length)) {
    return NextResponse.json({ error: "Card inexistente." }, { status: 400 });
  }
  const instruction = typeof body.instruction === "string" ? body.instruction.trim().slice(0, 1000) : null;

  after(() => runGeneration(id, index === null ? {} : { onlyIndexes: [index], instruction }));
  return NextResponse.json({ ok: true }, { status: 202 });
}
