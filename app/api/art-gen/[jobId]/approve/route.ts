import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const { jobId } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("art_generation_job")
    .update({ approved: true, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
