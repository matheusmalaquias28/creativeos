import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toStudioCarousel } from "@/services/carousel-studio";
import { isStudioBusy, isStudioDocument, type StudioStatus } from "@/types/carousel-studio";
import type { Database, Json } from "@/types/database";

type Params = { params: Promise<{ id: string }> };

const MAX_DOCUMENT_BYTES = 2_000_000;

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data } = await supabase.from("studio_carousels").select("*").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Carrossel não encontrado" }, { status: 404 });
  return NextResponse.json({ carousel: toStudioCarousel(data) });
}

/** Autosave do editor: documento, nome, legenda e instrução da próxima geração. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const raw = await req.text();
  if (raw.length > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: "Documento grande demais — evite colar imagens embutidas" }, { status: 413 });
  }
  let body: {
    document?: unknown;
    name?: string;
    caption?: string | null;
    brief?: string | null;
    reference_urls?: string[];
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const update: Database["public"]["Tables"]["studio_carousels"]["Update"] = {};
  if (body.document !== undefined) {
    if (!isStudioDocument(body.document)) {
      return NextResponse.json({ error: "Documento inválido" }, { status: 400 });
    }
    const { data: current } = await supabase.from("studio_carousels").select("status").eq("id", id).maybeSingle();
    if (current && isStudioBusy(current.status as StudioStatus)) {
      return NextResponse.json({ error: "Aguarde a geração terminar para editar" }, { status: 409 });
    }
    update.document = body.document as unknown as Json;
    const first = body.document.pages[0]?.layers.find((l) => l.type === "image" && l.src && l.role !== "logo");
    if (first && first.type === "image") update.thumbnail_url = first.src;
  }
  if (typeof body.name === "string") update.name = body.name.trim().slice(0, 160) || "Carrossel";
  if (body.caption !== undefined) update.caption = body.caption;
  if (body.brief !== undefined) update.brief = body.brief;
  if (Array.isArray(body.reference_urls)) {
    update.reference_urls = body.reference_urls.filter((u) => typeof u === "string" && u.startsWith("http")).slice(0, 12);
  }

  const { data, error } = await supabase
    .from("studio_carousels")
    .update(update)
    .eq("id", id)
    .select("updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Carrossel não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, updated_at: data.updated_at });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { error } = await supabase.from("studio_carousels").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
