/**
 * POST /api/art-gen/[jobId]/approve
 *
 * Marca (ou desmarca) a arte como aprovada. O corpo é opcional: sem ele a arte
 * é aprovada, que é o caminho de sempre. `{ approved: false }` existe porque o
 * estúdio separa aprovadas de pendentes — sem desfazer, um clique errado
 * mandava a arte para o lote de stories sem volta.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { jobId } = await params;

  let body: { approved?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const approved = body.approved ?? true;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("art_generation_job")
    .update({ approved, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, approved });
}
