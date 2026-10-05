import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { uploadStudioImage } from "@/lib/carousel-studio/images";

const MAX_SIZE = 12 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

type Params = { params: Promise<{ id: string }> };

/**
 * Upload de imagem para o carrossel: camada (foto, elemento, logo) ou
 * referência visual extra desta demanda (`kind=reference`, entra na próxima
 * geração).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const kind = form.get("kind") === "reference" ? "reference" : "layer";
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Selecione uma imagem" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Use PNG, JPG ou WebP" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Imagem muito grande (máx. 12MB)" }, { status: 400 });

  const { data: row } = await supabase.from("studio_carousels").select("id, reference_urls").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Carrossel não encontrado" }, { status: 404 });

  const input = Buffer.from(await file.arrayBuffer());
  // Normaliza a orientação EXIF e limita o tamanho (fotos de celular vêm gigantes).
  const pipeline = sharp(input).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true });
  const keepAlpha = file.type === "image/png" || file.type === "image/webp";
  const buffer = keepAlpha ? await pipeline.png().toBuffer() : await pipeline.jpeg({ quality: 90 }).toBuffer();
  const meta = await sharp(buffer).metadata();
  const url = await uploadStudioImage(id, buffer, keepAlpha ? "image/png" : "image/jpeg");

  if (kind === "reference") {
    const current = Array.isArray(row.reference_urls) ? (row.reference_urls as string[]) : [];
    await supabase
      .from("studio_carousels")
      .update({ reference_urls: [...current, url].slice(-12) })
      .eq("id", id);
  }

  return NextResponse.json({ url, width: meta.width ?? 0, height: meta.height ?? 0 });
}
