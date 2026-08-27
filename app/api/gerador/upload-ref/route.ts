import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "art-generations";

export async function POST(req: NextRequest) {
  const body = await req.json() as { base64: string; mimeType: string };

  if (!body.base64 || !body.mimeType) {
    return NextResponse.json({ error: "base64 e mimeType obrigatórios" }, { status: 400 });
  }

  const ext = body.mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const storagePath = `gerador/refs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const buffer = Buffer.from(body.base64, "base64");
  const supabase = createAdminClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: body.mimeType, upsert: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const url = `${baseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;
  return NextResponse.json({ url });
}
