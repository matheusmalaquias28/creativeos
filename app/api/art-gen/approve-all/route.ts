/**
 * POST /api/art-gen/approve-all
 * O caminho feliz: 400 artes/mês passam por aqui, então aprovar a demanda
 * inteira tem que ser um clique só.
 */

import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { approveAllPrompts } from "@/services/art-director";
import { runWorker } from "@/lib/ai/imagegen/worker";

// Cobre o pior caso: várias artes, cada uma com até IMAGE_JOB_TIMEOUT_MS
// (2min) de geração, processadas com concorrência limitada.
export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: { demandId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.demandId) {
    return NextResponse.json({ error: "demandId é obrigatório" }, { status: 400 });
  }

  try {
    const approved = await approveAllPrompts(body.demandId, user.id);

    if (approved > 0) {
      const demandId = body.demandId;
      // `after()`, não `setImmediate` — ver comentário em queue/route.ts.
      after(() =>
        runWorker(demandId).catch((err) => {
          console.error("[art-gen/approve-all]", (err as Error)?.message ?? err);
        })
      );
    }

    return NextResponse.json({ ok: true, approved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
