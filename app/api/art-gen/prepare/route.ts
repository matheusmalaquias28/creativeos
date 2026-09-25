/**
 * POST /api/art-gen/prepare
 *
 * Cria os jobs da demanda e roda o diretor de arte em sequência. Os prompts
 * ficam em `awaiting_approval` — nada é gerado como imagem até o operador
 * aprovar. Fire-and-forget: a UI acompanha por Supabase Realtime.
 *
 * O /api/art-gen/queue legado continua existindo e não muda.
 */

import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prepareDemandPrompts } from "@/lib/ai/art-director/prepare";

export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: { demandId?: string; wait?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { demandId, wait = false } = body;
  if (!demandId) {
    return NextResponse.json({ error: "demandId é obrigatório" }, { status: 400 });
  }

  if (wait) {
    try {
      const result = await prepareDemandPrompts(demandId);
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      return NextResponse.json({ error: message }, { status: 422 });
    }
  }

  // Valida o que é barato de validar antes de responder, para o operador não
  // ficar olhando skeletons quando o cliente simplesmente não está pronto.
  const { data: demand } = await supabase
    .from("creative_demands")
    .select("client_id")
    .eq("id", demandId)
    .maybeSingle();

  if (!demand?.client_id) {
    return NextResponse.json(
      { error: "Vincule um cliente à demanda antes de gerar prompts" },
      { status: 422 }
    );
  }

  const { data: readiness } = await supabase
    .from("client_art_readiness")
    .select("is_ready")
    .eq("client_id", demand.client_id)
    .maybeSingle();

  if (!readiness?.is_ready) {
    return NextResponse.json(
      { error: "Cliente sem kit completo (logo, paleta, DNA e 4+ referências)" },
      { status: 422 }
    );
  }

  // `after()`, não `setImmediate` — numa function serverless o processo pode
  // ser congelado assim que a resposta é enviada, e um setImmediate agendado
  // depois disso nunca roda (job fica preso sem erro nenhum).
  after(() =>
    prepareDemandPrompts(demandId).catch((err) => {
      console.error("[art-gen/prepare]", (err as Error)?.message ?? err);
    })
  );

  return NextResponse.json({ ok: true, started: true });
}
