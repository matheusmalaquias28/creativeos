/**
 * POST /api/art-gen/[jobId]/adjust
 * Ajuste por instrução via chat multi-turn do SDK @google/genai.
 * Cria nova art_version; nunca sobrescreve a versão anterior.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createArtEditSession,
  editArtInSession,
  type ImageSize,
  type AspectRatio,
} from "@/lib/ai/imagegen/client";
import { urlToInlineDataPart } from "@/lib/ai/imagegen/storage-refs";
import { compositeLogoFromBase64 } from "@/lib/ai/imagegen/logo-composite";
import type { LogoPlacement } from "@/lib/ai/imagegen/logo-composite";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { jobId } = await params;

  let body: { instruction?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { instruction } = body;
  if (!instruction?.trim()) {
    return NextResponse.json({ error: "instruction is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Busca job + versão atual
  const { data: job, error: jobError } = await supabase
    .from("art_generation_job")
    .select("id, client_id, params, status")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { data: currentVersion, error: versionError } = await supabase
    .from("art_version")
    .select("id, version_number, result_url, storage_path")
    .eq("job_id", jobId)
    .eq("is_current", true)
    .single();

  if (versionError || !currentVersion) {
    return NextResponse.json({ error: "No current version found" }, { status: 404 });
  }

  // Busca perfil do cliente para logo_mode e placement
  const { data: profile } = await supabase
    .from("client_creative_profile")
    .select("logo_url, logo_mode, logo_placement, image_size, aspect_ratio")
    .eq("client_id", job.client_id!)
    .maybeSingle();

  const jobParams = (job.params ?? {}) as Record<string, unknown>;

  try {
    // Baixa imagem atual como inlineData
    const currentPart = await urlToInlineDataPart(currentVersion.result_url);

    // Chat multi-turn (SDK gerencia thought signatures)
    const session = createArtEditSession();
    let { base64, mimeType } = await editArtInSession(
      session,
      currentPart.inlineData.data,
      currentPart.inlineData.mimeType,
      instruction,
      (jobParams.image_size as ImageSize) ?? profile?.image_size ?? "2K",
      (jobParams.aspect_ratio as AspectRatio) ?? profile?.aspect_ratio ?? "1:1"
    );

    // Reaplica logo composite se necessário
    if (profile?.logo_mode === "composite" && profile.logo_url) {
      const logoPart = await urlToInlineDataPart(profile.logo_url);
      const composited = await compositeLogoFromBase64({
        artBase64: base64,
        artMimeType: mimeType,
        logoBase64: logoPart.inlineData.data,
        logoMimeType: logoPart.inlineData.mimeType,
        placement: (profile.logo_placement ?? {}) as LogoPlacement,
      });
      base64 = composited.base64;
      mimeType = composited.mimeType;
    }

    const newVersionNumber = currentVersion.version_number + 1;
    const ext = mimeType.includes("png") ? "png" : "jpg";
    const storagePath = `${jobId}/v${newVersionNumber}.${ext}`;

    // Upload ao Storage
    const buffer = Buffer.from(base64, "base64");
    const { error: uploadError } = await supabase.storage
      .from("art-generations")
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data: urlData } = supabase.storage
      .from("art-generations")
      .getPublicUrl(storagePath);

    // Transação: desmarca is_current da versão anterior + insere nova
    await supabase
      .from("art_version")
      .update({ is_current: false })
      .eq("job_id", jobId)
      .eq("is_current", true);

    const { data: newVersion, error: insertError } = await supabase
      .from("art_version")
      .insert({
        job_id: jobId,
        version_number: newVersionNumber,
        result_url: urlData.publicUrl,
        storage_path: storagePath,
        instruction: instruction.trim(),
        is_current: true,
      })
      .select("id, version_number, result_url, instruction, is_current, created_at")
      .single();

    if (insertError) throw new Error(insertError.message);

    // Garante que o job está como 'succeeded'
    await supabase
      .from("art_generation_job")
      .update({ status: "succeeded", updated_at: new Date().toISOString() })
      .eq("id", jobId);

    return NextResponse.json({ ok: true, version: newVersion });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
