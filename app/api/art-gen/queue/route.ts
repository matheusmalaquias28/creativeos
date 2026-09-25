/**
 * POST /api/art-gen/queue
 *
 * "Gerar artes" direto da curadoria: roda o diretor de arte (em paralelo, um
 * layout mestre distinto por arte), aprova os briefings automaticamente e gera
 * tudo pelo Gemini — sem Magnific. Para revisar os briefings antes de gerar,
 * o caminho é a página de prompts (/api/art-gen/prepare + approve).
 *
 * A resposta volta na hora; o progresso chega pelo Supabase Realtime.
 *
 * O disparo usa `after()` (não `setImmediate`): numa function serverless
 * (Vercel), o processo pode ser congelado assim que a resposta HTTP é
 * enviada, e um `setImmediate` agendado depois disso nunca chega a rodar —
 * os jobs ficam presos em "queued" pra sempre, sem erro nenhum.
 */

import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWorker } from "@/lib/ai/imagegen/worker";
import { prepareDemandPrompts } from "@/lib/ai/art-director/prepare";
import { approveAllPrompts } from "@/services/art-director";

// Direção em paralelo (~30s) + geração com revisão (~1–2min por onda).
export const maxDuration = 300;

function verifySecret(request: Request): boolean {
  const secret = process.env.ART_GEN_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { demandId?: string; skipGenerate?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { demandId, skipGenerate = false } = body;
  if (!demandId) {
    return NextResponse.json({ error: "demandId is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: demand, error: demandError } = await supabase
    .from("creative_demands")
    .select("id, client_id, artes")
    .eq("id", demandId)
    .single();

  if (demandError || !demand) {
    return NextResponse.json({ error: "Demand not found" }, { status: 404 });
  }
  if (!demand.client_id) {
    return NextResponse.json({ error: "Demand has no linked client" }, { status: 422 });
  }

  const artes = Array.isArray(demand.artes) ? demand.artes : [];
  if (artes.length === 0) {
    return NextResponse.json({ ok: true, jobsCreated: 0, message: "No artes in demand" });
  }

  // Valida o kit antes de responder, para a UI mostrar o motivo na hora.
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

  after(async () => {
    try {
      await prepareDemandPrompts(demandId, { parallel: true });
      if (skipGenerate) return;
      const approved = await approveAllPrompts(demandId, null);
      if (approved > 0) await runWorker(demandId);
    } catch (err) {
      console.error("[art-gen/queue]", (err as Error)?.message ?? err);
    }
  });

  return NextResponse.json({ ok: true, jobsCreated: artes.length });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "/api/art-gen/queue", method: "POST" });
}
