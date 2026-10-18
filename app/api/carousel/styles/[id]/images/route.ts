/**
 * Artes de exemplo de um estilo de carrossel.
 *  POST   — upload de UMA arte (o client manda uma requisição por arquivo)
 *  DELETE — remove a arte (?imageId=)
 *
 * Subir ou tirar arte não reanalisa o estilo sozinho: o DNA depende do
 * conjunto, então o operador clica "Analisar" quando terminar de montar.
 */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "carousel-styles";
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGES_PER_STYLE = 20;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  const admin = createAdminClient();
  const { data: style } = await admin.from("carousel_styles").select("id").eq("id", id).eq("active", true).maybeSingle();
  if (!style) return NextResponse.json({ error: "Estilo não encontrado" }, { status: 404 });

  const { data: existing } = await admin
    .from("carousel_style_images")
    .select("position")
    .eq("style_id", id)
    .order("position", { ascending: false });
  if ((existing?.length ?? 0) >= MAX_IMAGES_PER_STYLE) {
    return NextResponse.json({ error: `Um estilo aceita até ${MAX_IMAGES_PER_STYLE} artes` }, { status: 400 });
  }
  // Uploads em paralelo podem pegar o mesmo "último"; a ordem final é a do
  // nome do arquivo no client e o operador ajusta se precisar.
  const requested = Number(formData.get("position"));
  const position = Number.isFinite(requested) && formData.get("position") !== null
    ? requested
    : (existing?.[0]?.position ?? -1) + 1;

  const bytes = Buffer.from(await file.arrayBuffer());
  let width: number | null = null;
  let height: number | null = null;
  try {
    const meta = await sharp(bytes).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
  } catch {
    // Dimensões são só para o grid.
  }

  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const storagePath = `${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
  const { data: image, error: insertError } = await admin
    .from("carousel_style_images")
    .insert({
      style_id: id,
      storage_url: publicUrl.publicUrl,
      storage_path: storagePath,
      file_name: file.name,
      width,
      height,
      position,
    })
    .select("*")
    .single();
  if (insertError || !image) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: insertError?.message ?? "Falha ao salvar" }, { status: 500 });
  }

  await admin.from("carousel_styles").update({ updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ image });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const imageId = request.nextUrl.searchParams.get("imageId");
  if (!imageId) return NextResponse.json({ error: "imageId é obrigatório" }, { status: 400 });

  const admin = createAdminClient();
  const { data: image } = await admin
    .from("carousel_style_images")
    .select("storage_path")
    .eq("id", imageId)
    .eq("style_id", id)
    .maybeSingle();
  if (!image) return NextResponse.json({ error: "Arte não encontrada" }, { status: 404 });

  const { error } = await admin.from("carousel_style_images").delete().eq("id", imageId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.storage.from(BUCKET).remove([image.storage_path]);
  return NextResponse.json({ ok: true });
}
