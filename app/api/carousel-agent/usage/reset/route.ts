import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInstagramAdmin } from "@/lib/instagram/http";
import { resetImageUsage } from "@/lib/carousel-agent/limits";

/**
 * Zera o teto diário de imagens do agente (só admin logado; a chave do agente
 * não chega aqui). O teto continua valendo a partir de agora.
 */
export async function POST() {
  const auth = await requireInstagramAdmin();
  if ("response" in auth) return auth.response;
  try {
    const cleared = await resetImageUsage(createAdminClient());
    console.info(`[carousel-agent] teto diário zerado por ${auth.user.id} (${cleared} imagens)`);
    return NextResponse.json({ ok: true, cleared });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao zerar o limite" }, { status: 500 });
  }
}
