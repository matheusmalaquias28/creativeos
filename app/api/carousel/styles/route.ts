/**
 * Acervo de estilos de carrossel.
 *  GET  — lista os estilos ativos com as artes
 *  POST — cria um estilo vazio ({ name, description?, client_id? })
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCarouselStyle, listCarouselStyles } from "@/services/carousel-styles";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  return NextResponse.json({ styles: await listCarouselStyles() });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: { name?: unknown; description?: unknown; client_id?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ error: "Dê um nome ao estilo" }, { status: 400 });

  const { data, error } = await supabase
    .from("carousel_styles")
    .insert({
      name,
      description: typeof body.description === "string" ? body.description.trim().slice(0, 2000) || null : null,
      client_id: typeof body.client_id === "string" && body.client_id ? body.client_id : null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Falha ao criar" }, { status: 500 });

  return NextResponse.json({ style: await getCarouselStyle(data.id) });
}
