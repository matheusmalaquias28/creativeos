/**
 * Acervo de referências de um cliente.
 *  POST   — upload + anotação por IA (síncrona: o operador quer ver a descrição
 *           na hora, e são ~2s)
 *  DELETE — desativa (soft) para não quebrar referências já usadas em artes
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createReferenceAsset,
  failAnnotation,
  saveAnnotation,
  setReferenceAssetActive,
} from "@/services/reference-assets";
import { annotateReference } from "@/lib/ai/annotate-reference";
import { isReferenceKind, type ReferenceKind } from "@/lib/ai/art-director/types";

const BUCKET = "client-reference-assets";
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const rawKind = String(formData.get("kind") ?? "estilo");
  const kind: ReferenceKind = isReferenceKind(rawKind) ? rawKind : "estilo";

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Selecione um arquivo" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Use PNG, JPG ou WebP" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Imagem muito grande (máx. 10MB)" }, { status: 400 });
  }

  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const storagePath = `${clientId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

  const asset = await createReferenceAsset({
    clientId,
    kind,
    storageUrl,
    storagePath,
    fileName: file.name,
  });

  // Anotação falhada não perde o upload: o asset fica no acervo com status
  // 'failed' e o operador pode reprocessar ou descrever à mão.
  try {
    const annotation = await annotateReference(storageUrl, kind);
    await saveAnnotation(asset.id, annotation);
    return NextResponse.json({ ok: true, asset: { ...asset, ...annotation } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na anotação";
    await failAnnotation(asset.id, message);
    return NextResponse.json({ ok: true, asset, annotationError: message });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const assetId = new URL(request.url).searchParams.get("assetId");
  if (!assetId) {
    return NextResponse.json({ error: "assetId é obrigatório" }, { status: 400 });
  }

  await setReferenceAssetActive(assetId, false);
  return NextResponse.json({ ok: true });
}
