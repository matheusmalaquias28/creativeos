import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claimStudioGeneration } from "@/services/carousel-studio";
import { runStudioGeneration } from "@/lib/carousel-studio/generate";

// Diretor (~30–60s) + imagens em paralelo (~1–3min). Tudo dentro do after().
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/**
 * (Re)gera o carrossel inteiro. Volta na hora; o progresso chega por Realtime.
 * `brief` é a instrução do operador para esta versão (ex.: "mais clean,
 * fundo claro, use fotos de escritório").
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: { brief?: string | null; force?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // body opcional
  }

  const claim = await claimStudioGeneration(id, {
    brief: typeof body.brief === "string" ? body.brief.trim().slice(0, 2000) || null : undefined,
    force: body.force === true,
  });
  if (!claim.ok) return NextResponse.json({ error: claim.reason }, { status: 409 });

  after(() => runStudioGeneration(id).catch((e) => console.error("[carousel-studio/generate]", e)));
  return NextResponse.json({ ok: true });
}
