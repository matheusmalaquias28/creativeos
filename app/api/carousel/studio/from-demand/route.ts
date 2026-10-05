import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claimStudioGeneration, ensureStudioForDemand } from "@/services/carousel-studio";
import { runStudioGeneration } from "@/lib/carousel-studio/generate";

export const maxDuration = 300;

/** Cria (se preciso) o studio de uma demanda de carrossel e, opcionalmente, gera. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: { demandId?: string; generate?: boolean; brief?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  if (!body.demandId) return NextResponse.json({ error: "Demanda não informada" }, { status: 400 });

  const studio = await ensureStudioForDemand(body.demandId);
  if (!studio) return NextResponse.json({ error: "Essa demanda não é do tipo carrossel" }, { status: 422 });

  if (body.generate) {
    const claim = await claimStudioGeneration(studio.id, {
      brief: typeof body.brief === "string" ? body.brief.trim() || null : undefined,
    });
    if (!claim.ok) return NextResponse.json({ error: claim.reason, id: studio.id }, { status: 409 });
    after(() => runStudioGeneration(studio.id).catch((e) => console.error("[carousel-studio/from-demand]", e)));
  }

  return NextResponse.json({ ok: true, id: studio.id });
}
