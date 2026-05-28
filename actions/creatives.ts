"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOwnedClient } from "@/lib/auth/verify-client";
import { buildNanoBananaPromptFromTemplate } from "@/lib/ai/build-nano-banana-prompt";
import { generateNanoBananaProImage } from "@/lib/ai/nano-banana-image";
import { buildNanoBananaProCompactPrompt } from "@/lib/ai/gemini-prompt-text";
import { normalizeAspectRatio } from "@/lib/ai/gemini-image";
import { getCreativeBrainById } from "@/services/creative-brain";
import { getClientReferences } from "@/services/clients";
import { parseOnboardingAnswers, getOnboardingAnswers } from "@/services/onboarding";
import type { BrandDna } from "@/types";

export type GenerateCreativeActionState = {
  error?: string;
  success?: boolean;
  creativeId?: string;
  publicUrl?: string;
};

type GenerateCreativeInput = {
  clientId: string;
  brainId: string;
  templateName: string;
  headline?: string;
  cta?: string;
  extraDetails?: string;
  useReferences?: boolean;
  useLogo?: boolean;
  aspectRatio?: string;
  quality?: string;
};

export async function generateCreativeAction(
  input: GenerateCreativeInput
): Promise<GenerateCreativeActionState> {
  const owned = await getOwnedClient(input.clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const brain = await getCreativeBrainById(input.brainId, input.clientId);
  if (!brain) return { error: "Creative Brain não encontrado" };

  const brandDna = brain.brand_dna as BrandDna;
  const template = brandDna.nanoBananaPro?.promptTemplates?.find(
    (t) => t.name === input.templateName
  );
  if (!template) {
    return { error: "Template de prompt não encontrado no Brand DNA" };
  }

  const aspectRatio = normalizeAspectRatio(input.aspectRatio ?? template.aspectRatio);

  const promptJsonString = buildNanoBananaPromptFromTemplate(
    template,
    brandDna,
    {
      headline: input.headline,
      cta: input.cta,
      extraDetails: input.extraDetails,
      aspectRatio,
    }
  );
  const promptPayload = JSON.parse(promptJsonString) as Record<string, unknown>;

  const onboarding = parseOnboardingAnswers(
    await getOnboardingAnswers(input.clientId)
  );

  let referenceUrls: string[] = [];
  if (input.useReferences !== false) {
    const refs = await getClientReferences(input.clientId);
    referenceUrls = refs.map((r) => r.public_url).filter(Boolean);
    if (input.useLogo !== false && onboarding.logoUrl) {
      referenceUrls = [onboarding.logoUrl, ...referenceUrls];
    }
  }

  const supabase = await createClient();
  const promptText = buildNanoBananaProCompactPrompt(promptPayload, input.quality);

  try {
    const { imageUrl, mimeType, model } = await generateNanoBananaProImage({
      prompt: promptText,
      aspectRatio,
      resolution: input.quality,
      referenceUrls: referenceUrls.length ? referenceUrls : undefined,
    });

    const imageResponse = await fetch(imageUrl, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!imageResponse.ok) {
      return { error: `Falha ao baixar imagem gerada: ${imageResponse.status}` };
    }
    const binary = Buffer.from(await imageResponse.arrayBuffer());

    const ext =
      mimeType === "image/jpeg"
        ? "jpg"
        : mimeType === "image/webp"
          ? "webp"
          : "png";
    const storagePath = `${owned.userId}/${input.clientId}/${Date.now()}-${template.name.replace(/[^a-zA-Z0-9-_]/g, "_")}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("generated-creatives")
      .upload(storagePath, binary, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      return { error: `Falha ao salvar imagem: ${uploadError.message}` };
    }

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publicUrl = `${baseUrl}/storage/v1/object/public/generated-creatives/${storagePath}`;

    const { data: row, error: dbError } = await supabase
      .from("generated_creatives")
      .insert({
        client_id: input.clientId,
        creative_brain_id: brain.id,
        template_name: template.name,
        prompt_payload: promptPayload,
        storage_path: storagePath,
        public_url: publicUrl,
        mime_type: mimeType,
        aspect_ratio: aspectRatio,
        model,
        status: "completed",
        created_by: owned.userId,
      })
      .select("id")
      .single();

    if (dbError || !row) {
      return { error: dbError?.message ?? "Erro ao registrar criativo" };
    }

    revalidatePath(`/clients/${input.clientId}`);
    revalidatePath(`/clients/${input.clientId}/creatives`);

    return {
      success: true,
      creativeId: row.id,
      publicUrl,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha na geração de imagem";
    return { error: message };
  }
}

export async function deleteCreativeAction(
  clientId: string,
  creativeId: string
): Promise<{ error?: string; success?: boolean }> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const supabase = await createClient();
  const { data: creative } = await supabase
    .from("generated_creatives")
    .select("storage_path")
    .eq("id", creativeId)
    .eq("client_id", clientId)
    .single();

  if (!creative) return { error: "Criativo não encontrado" };

  if (creative.storage_path && creative.storage_path !== "failed") {
    await supabase.storage
      .from("generated-creatives")
      .remove([creative.storage_path]);
  }

  const { error } = await supabase
    .from("generated_creatives")
    .delete()
    .eq("id", creativeId);

  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}/creatives`);
  return { success: true };
}
