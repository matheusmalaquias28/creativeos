/**
 * POST /api/art-gen/[jobId]/versions/[versionId]/restore
 * Restaura uma versão anterior movendo is_current (não destrói outras versões).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ jobId: string; versionId: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const { jobId, versionId } = await params;

  const supabase = createAdminClient();

  // Verifica se a versão pertence ao job
  const { data: version, error: versionError } = await supabase
    .from("art_version")
    .select("id, job_id, version_number")
    .eq("id", versionId)
    .eq("job_id", jobId)
    .single();

  if (versionError || !version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Desmarca todas as versões do job
  await supabase
    .from("art_version")
    .update({ is_current: false })
    .eq("job_id", jobId);

  // Marca a versão escolhida como current
  const { error: updateError } = await supabase
    .from("art_version")
    .update({ is_current: true })
    .eq("id", versionId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, restoredVersionId: versionId });
}
