/**
 * POST /api/art-gen/[jobId]/adjust
 * Ajuste por instrução via chat multi-turn do SDK @google/genai.
 * Cria nova art_version; nunca sobrescreve a versão anterior.
 *
 * Edita a versão SEM logo (vN_raw.png) quando ela existe e recompõe a logo real
 * por cima — o modelo nunca redesenha a logo e ela nunca sai duplicada. Artes
 * antigas, sem versão raw, são editadas como estão (a logo já está na imagem).
 */

import { NextResponse } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createArtEditSession,
  editArtInSession,
  type ImageSize,
  type AspectRatio,
} from "@/lib/ai/imagegen/client";
import { urlToInlineDataPart } from "@/lib/ai/imagegen/storage-refs";
import { compositeBrandLogo, prepareLogo } from "@/lib/ai/imagegen/brand-logo";
import { IMAGE_GEN_DEFAULTS } from "@/lib/ai/imagegen/defaults";

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
    .select("logo_url, palette, image_size, aspect_ratio")
    .eq("client_id", job.client_id!)
    .maybeSingle();

  const jobParams = (job.params ?? {}) as Record<string, unknown>;

  try {
    // Prefere a versão sem logo; cai para a versão atual em artes antigas.
    const rawPath = currentVersion.storage_path.replace(/\.(png|jpe?g)$/i, "_raw.png");
    const { data: rawUrlData } = supabase.storage.from("art-generations").getPublicUrl(rawPath);
    const rawPart = await urlToInlineDataPart(rawUrlData.publicUrl).catch(() => null);
    const hasRaw = Boolean(rawPart);
    const sourcePart = rawPart ?? (await urlToInlineDataPart(currentVersion.result_url));

    const guardedInstruction = hasRaw
      ? `${instruction.trim()}\n\nKeep everything else as it is. Keep the top-centre band (4–15% of the height) clean — the brand logo goes there afterwards; never draw a logo. Keep the button horizontally centred near the bottom. Do not add any text that is not already in the image.`
      : instruction.trim();

    // Chat multi-turn (SDK gerencia thought signatures)
    const session = createArtEditSession();
    const edited = await editArtInSession(
      session,
      sourcePart.inlineData.data,
      sourcePart.inlineData.mimeType,
      guardedInstruction,
      (jobParams.image_size as ImageSize) ?? profile?.image_size ?? IMAGE_GEN_DEFAULTS.imageSize,
      (jobParams.aspect_ratio as AspectRatio) ?? profile?.aspect_ratio ?? IMAGE_GEN_DEFAULTS.aspectRatio
    );

    const rawBuffer = await sharp(Buffer.from(edited.base64, "base64")).png().toBuffer();
    let finalBuffer: Buffer = rawBuffer;
    if (hasRaw && profile?.logo_url) {
      const logoPart = await urlToInlineDataPart(profile.logo_url);
      const cleanLogo = await prepareLogo(Buffer.from(logoPart.inlineData.data, "base64"));
      finalBuffer = (
        await compositeBrandLogo({
          art: rawBuffer,
          logo: cleanLogo,
          palette: (profile.palette as string[] | null) ?? [],
        })
      ).buffer;
    }
    const base64 = finalBuffer.toString("base64");
    const mimeType = "image/png";

    const newVersionNumber = currentVersion.version_number + 1;
    const ext = mimeType.includes("png") ? "png" : "jpg";
    const storagePath = `${jobId}/v${newVersionNumber}.${ext}`;

    // Upload ao Storage
    const buffer = Buffer.from(base64, "base64");
    const { error: uploadError } = await supabase.storage
      .from("art-generations")
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    if (hasRaw) {
      await supabase.storage
        .from("art-generations")
        .upload(`${jobId}/v${newVersionNumber}_raw.png`, rawBuffer, {
          contentType: "image/png",
          upsert: true,
        })
        .catch(() => undefined);
    }

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
