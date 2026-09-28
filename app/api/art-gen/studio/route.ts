/**
 * GET /api/art-gen/studio?demandId=…
 *
 * Estado inicial do estúdio. O modal busca ao abrir em vez de receber o estado
 * pela página: entre carregar a demanda e clicar em "Gerar Criativos" pode ter
 * passado meia hora, e abrir com o que era verdade naquele momento é o tipo de
 * confusão que este trabalho todo existe para tirar da tela.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStudioState } from "@/services/art-studio";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const demandId = new URL(request.url).searchParams.get("demandId");
  if (!demandId) {
    return NextResponse.json({ error: "demandId é obrigatório" }, { status: 400 });
  }

  try {
    const state = await getStudioState(demandId);
    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
