import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "art-generations";
const MAX_SIZE = 8 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

/** Upload de foto de perfil ou imagem de card do carrossel tweet. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const kind = formData.get("kind") === "avatar" ? "avatars" : "cards";
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Selecione uma imagem" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Use PNG, JPG ou WebP" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Imagem muito grande (máx. 8MB)" }, { status: 400 });
  }

  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const storagePath = `tweet-carousels/${user.id}/${kind}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const url = `${baseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;
  return NextResponse.json({ url });
}
