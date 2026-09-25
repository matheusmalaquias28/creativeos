/**
 * Referências de uma arte específica.
 *  POST   — anexa uma referência (do acervo ou upload pontual)
 *  DELETE — remove uma referência e reindexa as posições
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addJobReference, removeJobReference } from "@/services/art-director";
import { isReferenceRole } from "@/lib/ai/art-director/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: { assetId?: string; storageUrl?: string; role?: string; intent?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.storageUrl) {
    return NextResponse.json({ error: "storageUrl é obrigatório" }, { status: 400 });
  }

  const role = body.role && isReferenceRole(body.role) ? body.role : "estilo";

  try {
    await addJobReference({
      jobId,
      assetId: body.assetId ?? null,
      storageUrl: body.storageUrl,
      role,
      intent: body.intent ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const referenceId = new URL(request.url).searchParams.get("referenceId");
  if (!referenceId) {
    return NextResponse.json({ error: "referenceId é obrigatório" }, { status: 400 });
  }

  try {
    await removeJobReference(referenceId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
