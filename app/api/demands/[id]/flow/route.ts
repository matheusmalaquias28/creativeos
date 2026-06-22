import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FlowGraph } from "@/lib/flow/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("creative_demands")
    .select("flow_graph")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ graph: data.flow_graph ?? null });
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const graph = (body as { graph?: FlowGraph }).graph;
  if (!graph) return NextResponse.json({ error: "graph is required" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("creative_demands")
    .update({ flow_graph: graph })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
