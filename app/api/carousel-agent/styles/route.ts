import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgentOrAdmin } from "@/lib/carousel-agent/auth";
import { listAgentStyles } from "@/lib/carousel-agent/studio";

/**
 * Estilos do Carrossel Studio que o agente pode usar no formato "studio", com
 * as páginas-modelo (código M1, M2…, papel e campos com o texto de exemplo).
 */
export async function GET(request: Request) {
  const auth = await requireAgentOrAdmin(request);
  if ("response" in auth) return auth.response;
  return NextResponse.json({ styles: await listAgentStyles(createAdminClient()) });
}
