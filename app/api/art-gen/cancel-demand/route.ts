/**
 * POST /api/art-gen/cancel-demand
 * Cancela todos os jobs queued/processing de uma demanda.
 * O worker verifica o status antes de processar e respeita o cancelamento.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  let body: { demandId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { demandId } = body;
  if (!demandId) return NextResponse.json({ error: "demandId is required" }, { status: 400 });

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("art_generation_job")
    .update({
      status: "failed",
      error: "Cancelado pelo operador",
      updated_at: new Date().toISOString(),
    })
    .eq("demand_id", demandId)
    .in("status", ["queued", "processing"])
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, cancelled: data?.length ?? 0 });
}
