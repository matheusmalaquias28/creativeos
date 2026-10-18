/**
 * Um estilo de carrossel.
 *  PATCH  — nome, descrição, cliente, papéis/ordem das artes
 *  DELETE — desativa (soft): carrosséis já gerados não dependem do estilo
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCarouselStyle } from "@/services/carousel-styles";
import type { Database } from "@/types/database";

type Params = { params: Promise<{ id: string }> };

const ROLES = ["cover", "inner", "cta"] as const;
type Role = (typeof ROLES)[number];

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: {
    name?: unknown;
    description?: unknown;
    client_id?: unknown;
    images?: Array<{ id?: unknown; role?: unknown; position?: unknown }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const update: Database["public"]["Tables"]["carousel_styles"]["Update"] = {};
  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: "O estilo precisa de um nome" }, { status: 400 });
    update.name = name;
  }
  if (body.description !== undefined) {
    update.description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) || null : null;
  }
  if (body.client_id !== undefined) {
    update.client_id = typeof body.client_id === "string" && body.client_id ? body.client_id : null;
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from("carousel_styles").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Ordem e papel das artes (capa / miolo / CTA).
  if (Array.isArray(body.images)) {
    for (const image of body.images) {
      if (typeof image.id !== "string") continue;
      const patch: Database["public"]["Tables"]["carousel_style_images"]["Update"] = {};
      if (image.role === null || ROLES.includes(image.role as Role)) patch.role = (image.role as Role | null) ?? null;
      if (typeof image.position === "number" && Number.isFinite(image.position)) patch.position = Math.round(image.position);
      if (Object.keys(patch).length === 0) continue;
      const { error } = await supabase
        .from("carousel_style_images")
        .update(patch)
        .eq("id", image.id)
        .eq("style_id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const style = await getCarouselStyle(id);
  if (!style) return NextResponse.json({ error: "Estilo não encontrado" }, { status: 404 });
  return NextResponse.json({ style });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { error } = await supabase.from("carousel_styles").update({ active: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
