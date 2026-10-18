import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeCarouselStyle } from "@/lib/carousel-styles/analyze";
import { getCarouselStyle } from "@/services/carousel-styles";
import type { Json } from "@/types/database";

// O Claude vê até 12 artes de uma vez: ~30–60s.
export const maxDuration = 180;

type Params = { params: Promise<{ id: string }> };

/** Lê todas as artes do estilo e grava o DNA. Síncrono — devolve o estilo atualizado. */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const style = await getCarouselStyle(id);
  if (!style || !style.active) return NextResponse.json({ error: "Estilo não encontrado" }, { status: 404 });
  if (style.images.length === 0) {
    return NextResponse.json({ error: "Suba as artes do estilo antes de analisar" }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin.from("carousel_styles").update({ analysis_status: "analyzing", analysis_error: null }).eq("id", id);

  try {
    const dna = await analyzeCarouselStyle({
      name: style.name,
      description: style.description,
      images: style.images.map((i) => ({ url: i.storage_url, role: i.role })),
    });
    await admin
      .from("carousel_styles")
      .update({
        dna: dna as unknown as Json,
        analysis_status: "ready",
        analysis_error: null,
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na análise";
    console.error("[carousel-styles/analyze]", id, message);
    await admin
      .from("carousel_styles")
      .update({ analysis_status: "failed", analysis_error: message.slice(0, 300) })
      .eq("id", id);
    return NextResponse.json({ error: message, style: await getCarouselStyle(id) }, { status: 502 });
  }

  return NextResponse.json({ style: await getCarouselStyle(id) });
}
