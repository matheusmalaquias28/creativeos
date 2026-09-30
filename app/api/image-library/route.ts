/**
 * Acervo global de imagens.
 *  GET    — lista o acervo ativo (o seletor da arte filtra no client)
 *  POST   — upload de UMA imagem + anotação por IA (síncrona, ~2s; o client
 *           manda uma requisição por arquivo para mostrar progresso)
 *  DELETE — desativa (soft): demandas que já usam a imagem continuam com a URL
 */

import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { annotateLibraryImage } from "@/lib/image-library/annotate";
import { listLibraryImages } from "@/services/image-library";

const BUCKET = "image-library";
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

export const maxDuration = 60;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const images = await listLibraryImages();
  return NextResponse.json({ images });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Selecione um arquivo" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: `Use PNG, JPG ou WebP (${file.name})` }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: `Imagem muito grande: ${file.name} (máx. 10MB)` }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  let width: number | null = null;
  let height: number | null = null;
  try {
    const meta = await sharp(bytes).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
  } catch {
    // Dimensões são só para o grid — sem elas o card cai no quadrado.
  }

  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(storagePath);

  const { data: row, error: insertError } = await admin
    .from("image_library")
    .insert({
      storage_url: publicUrl.publicUrl,
      storage_path: storagePath,
      file_name: file.name,
      width,
      height,
      annotation_status: "annotating",
      created_by: user.id,
    })
    .select("*")
    .single();

  if (insertError || !row) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: insertError?.message ?? "Falha ao salvar" }, { status: 500 });
  }

  // Anotação falhada não perde o upload: a imagem fica no acervo, só não é
  // achada pela busca por assunto (ainda aparece pelo nome do arquivo).
  try {
    const annotation = await annotateLibraryImage(publicUrl.publicUrl);
    const { data: annotated } = await admin
      .from("image_library")
      .update({
        ai_description: annotation.description,
        ai_tags: annotation.tags,
        suggested_category: annotation.suggestedCategory,
        annotation_status: "ready",
        annotation_error: null,
      })
      .eq("id", row.id)
      .select("*")
      .single();
    return NextResponse.json({ image: annotated ?? row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na anotação";
    await admin
      .from("image_library")
      .update({ annotation_status: "failed", annotation_error: message.slice(0, 300) })
      .eq("id", row.id);
    return NextResponse.json({
      image: { ...row, annotation_status: "failed", annotation_error: message },
      annotationError: message,
    });
  }
}

export async function DELETE(request: Request) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("image_library").update({ active: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
