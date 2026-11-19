import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgentOrAdmin } from "@/lib/carousel-agent/auth";
import { appUrl, getRun, publicRun } from "@/lib/carousel-agent/runs";

type Params = { params: Promise<{ id: string }> };

/** Status de um carrossel (o agente consulta aqui se não usar callback). */
export async function GET(request: Request, { params }: Params) {
  const auth = await requireAgentOrAdmin(request);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const run = await getRun(createAdminClient(), id);
  if (!run) return NextResponse.json({ error: "Carrossel não encontrado" }, { status: 404 });
  return NextResponse.json(publicRun(run, appUrl()));
}
