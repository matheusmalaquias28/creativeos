/**
 * POST /api/art-gen/queue
 * Cria os jobs e dispara o worker em background (fire-and-forget).
 * A resposta retorna imediatamente após criar os jobs;
 * o progresso é acompanhado via Supabase Realtime no frontend.
 *
 * Funciona em VPS/Node.js tradicional. Em serverless (Vercel), o processo
 * pode ser encerrado antes do worker terminar — use um cron externo nesse caso.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWorker } from "@/lib/ai/imagegen/worker";
import type { Database, Json } from "@/types/database";

type ArtJobInsert = Database["public"]["Tables"]["art_generation_job"]["Insert"];

function verifySecret(request: Request): boolean {
  const secret = process.env.ART_GEN_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * POST /api/art-gen/queue — cria jobs para uma demanda e dispara o worker.
 */
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

  // Busca a demanda e o perfil do cliente
  const { data: demand, error: demandError } = await supabase
    .from("creative_demands")
    .select("id, client_id, briefing, artes")
    .eq("id", demandId)
    .single();

  if (demandError || !demand) {
    return NextResponse.json({ error: "Demand not found" }, { status: 404 });
  }

  if (!demand.client_id) {
    return NextResponse.json(
      { error: "Demand has no linked client" },
      { status: 422 }
    );
  }

  // Busca perfil criativo
  const { data: profile } = await supabase
    .from("client_creative_profile")
    .select("image_size, aspect_ratio")
    .eq("client_id", demand.client_id)
    .maybeSingle();

  // Cria um job por arte da demanda
  const artes = Array.isArray(demand.artes) ? demand.artes : [];
  const briefing = (demand.briefing ?? {}) as Record<string, unknown>;

  const jobs: ArtJobInsert[] = (artes as Json[]).map((arteJson, index) => {
    const arte = (arteJson ?? {}) as Record<string, unknown>;
    return {
      demand_id: demandId,
      client_id: demand.client_id,
      art_index: index,
      status: "queued" as const,
      params: {
        headline: (arte.headline as string) ?? null,
        subheadline: (arte.subheadline as string) ?? null,
        cta: (arte.cta as string) ?? null,
        informacoesExtras: (arte.informacoesExtras as string) ?? null,
        aspect_ratio: (arte.aspectRatio as string) ?? profile?.aspect_ratio ?? "1:1",
        image_size: (arte.imageSize as string) ?? profile?.image_size ?? "2K",
        briefing_titulo: (briefing.titulo as string) ?? null,
        briefing_tipo: (briefing.tipo as string) ?? null,
      } as Json,
    };
  });

  if (jobs.length === 0) {
    return NextResponse.json({ ok: true, jobsCreated: 0, message: "No artes in demand" });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("art_generation_job")
    .insert(jobs)
    .select("id");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Dispara o worker em background (fire-and-forget).
  // O cliente acompanha o progresso via Supabase Realtime — não precisa aguardar.
  if (!skipGenerate) {
    setImmediate(() => {
      void runWorker(demandId).catch((err) => {
        console.error("[art-gen/worker]", (err as Error)?.message ?? err);
      });
    });
  }

  return NextResponse.json({ ok: true, jobsCreated: inserted?.length ?? 0 });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "/api/art-gen/queue", method: "POST" });
}
