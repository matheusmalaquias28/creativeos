/**
 * POST /api/art-gen/[jobId]/redirect
 * Regenera o prompt com uma direção do operador ("mais minimalista", "sem
 * pessoas"). Mais barato que editar à mão e um sinal muito mais limpo para o
 * loop de aprendizado do que um diff de prosa.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rewriteJobPrompt } from "@/lib/ai/art-director/prepare";

export const maxDuration = 120;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: { steer?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const direction = await rewriteJobPrompt(jobId, body.steer?.trim() || null);
    return NextResponse.json({ ok: true, concept: direction.concept });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
