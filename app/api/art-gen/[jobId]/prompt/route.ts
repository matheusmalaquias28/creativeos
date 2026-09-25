/** PATCH /api/art-gen/[jobId]/prompt — salva a edição do operador no prompt. */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveEditedPrompt } from "@/services/art-director";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: { prompt?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return NextResponse.json({ error: "prompt é obrigatório" }, { status: 400 });
  }

  try {
    await saveEditedPrompt(jobId, body.prompt);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
