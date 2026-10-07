/**
 * Upload de imagens soltas do canvas (ex.: arquivos enviados para um node de
 * Lista). Sobe para o Storage e devolve a URL pública — o grafo guarda só a
 * URL, nunca base64. Não passa pelo acervo global (sem anotação, sem catálogo).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "art-generations";
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: demandId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const storagePath = `flow-uploads/${demandId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
  return NextResponse.json({ url: data.publicUrl });
}
