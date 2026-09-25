/**
 * POST /api/art-gen/[jobId]/approve-prompt
 * awaiting_approval → queued e dispara o worker. É aqui que o uso das
 * referências é incrementado — não no rascunho.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { approvePrompt } from "@/services/art-director";
import { runWorker } from "@/lib/ai/imagegen/worker";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const approved = await approvePrompt(jobId, user.id);
    if (approved === 0) {
      return NextResponse.json(
        { error: "Este prompt não está aguardando aprovação" },
        { status: 409 }
      );
    }

    const { data: job } = await supabase
      .from("art_generation_job")
      .select("demand_id")
      .eq("id", jobId)
      .single();

    if (job?.demand_id) {
      setImmediate(() => {
        void runWorker(job.demand_id as string).catch((err) => {
          console.error("[art-gen/approve-prompt]", (err as Error)?.message ?? err);
        });
      });
    }

    return NextResponse.json({ ok: true, approved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
