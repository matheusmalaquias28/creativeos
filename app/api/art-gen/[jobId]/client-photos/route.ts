/**
 * POST /api/art-gen/[jobId]/client-photos { use: boolean }
 *
 * Liga/desliga as fotos reais do cliente nesta arte e reescreve o prompt — a
 * cena muda quando há uma pessoa real no quadro, então marcar o flag sem
 * redirigir entregaria uma arte com a foto colada numa composição que não a
 * previu.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setUseClientPhotos } from "@/services/art-director";
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

  let body: { use?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const use = Boolean(body.use);

  try {
    await setUseClientPhotos(jobId, use);

    const steer = use
      ? "Componha a cena em torno da pessoa real das fotos fornecidas: ela é o assunto principal do quadro."
      : "Refaça a cena sem nenhuma pessoa identificável do cliente.";

    const direction = await rewriteJobPrompt(jobId, steer);
    return NextResponse.json({ ok: true, use, concept: direction.concept });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
