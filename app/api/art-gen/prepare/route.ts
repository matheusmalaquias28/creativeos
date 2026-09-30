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
import { z } from "zod";
import { approvePrompt } from "@/services/art-director";
import { runWorker } from "@/lib/ai/imagegen/worker";
import { createClient } from "@/lib/supabase/server";
import { prepareDemandPrompts } from "@/lib/ai/art-director/prepare";

export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const schema = z.object({ demandId: z.string().uuid(), wait: z.boolean().optional(), generate: z.boolean().optional(), visualMode: z.enum(["free", "guided", "brand"]).optional(), visualNotes: z.string().max(2000).optional() });
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { demandId, wait = false } = body;
  const options = { visualMode: body.visualMode, visualNotes: body.visualNotes };
  if (!demandId) {
    return NextResponse.json({ error: "demandId é obrigatório" }, { status: 400 });
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
    .select("has_logo")
    .eq("client_id", demand.client_id)
    .maybeSingle();

  if (!readiness?.has_logo) {
    return NextResponse.json(
      { error: "Cadastre a logo do cliente. Identidade visual e referências são opcionais." },
      { status: 422 }
    );
  }

  const { count: activeCount, error: activeError } = await supabase.from("art_generation_job").select("id", { count: "exact", head: true }).eq("demand_id", demandId).in("status", ["draft", "writing_prompt", "queued", "processing"]);
  if (activeError) return NextResponse.json({ error: "Não foi possível verificar a geração atual" }, { status: 500 });
  if (activeCount) return NextResponse.json({ error: "Esta demanda já tem uma geração em andamento" }, { status: 409 });

  const execute = async () => {
    const result = await prepareDemandPrompts(demandId, options);
    if (body.generate) {
      for (const id of result.jobIds) await approvePrompt(id, user.id);
      if (result.jobIds.length) await runWorker(demandId);
    }
    return result;
  };
  if (wait) {
    try { return NextResponse.json({ ok: true, ...await execute() }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao gerar" }, { status: 422 }); }
  }
  after(() => execute().catch((error) => console.error("[art-gen/prepare]", error)));
  return NextResponse.json({ ok: true, started: true });
}
