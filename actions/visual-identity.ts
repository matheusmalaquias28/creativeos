"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getOwnedClient } from "@/lib/auth/verify-client";
import {
  buildBasePromptFromDna,
  extractVisualIdentityFromImages,
} from "@/lib/ai/extract-visual-identity";
import {
  visualIdentityDnaSchema,
  type VisualIdentityDna,
} from "@/lib/schemas/visual-identity";
import { upsertCreativeProfile } from "@/services/art-gen";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_SAMPLES = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const BUCKET = "client-identity-samples";

export type VisualIdentityActionState = {
  error?: string;
  success?: boolean;
  sampleUrls?: string[];
  status?: string;
};

async function runIdentityExtraction(clientId: string, sampleUrls: string[]): Promise<void> {
  const admin = createAdminClient();

  await admin
    .from("client_creative_profile")
    .upsert(
      {
        client_id: clientId,
        identity_extraction_status: "extracting",
        identity_extraction_error: null,
      },
      { onConflict: "client_id" }
    );

  try {
    const { data: client } = await admin
      .from("clients")
      .select("name")
      .eq("id", clientId)
      .maybeSingle();

    const dna = await extractVisualIdentityFromImages(sampleUrls, client?.name ?? undefined);
    const basePrompt = buildBasePromptFromDna(dna);
    const now = new Date().toISOString();

    await upsertCreativeProfile(clientId, {
      identity_sample_urls: sampleUrls,
      visual_identity_dna: dna,
      identity_extracted_at: now,
      identity_extraction_status: "ready",
      identity_extraction_error: null,
      base_prompt: basePrompt,
      palette: dna.palette,
      style_reference_urls: sampleUrls,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    await admin
      .from("client_creative_profile")
      .upsert(
        {
          client_id: clientId,
          identity_extraction_status: "failed",
          identity_extraction_error: message,
        },
        { onConflict: "client_id" }
      );
  }
}

export async function uploadIdentitySampleAction(
  clientId: string,
  formData: FormData
): Promise<VisualIdentityActionState> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const files = formData.getAll("sample").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return { error: "Selecione ao menos uma arte de referência" };
  }
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { error: `${file.name}: use PNG, JPG ou WebP` };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { error: `${file.name}: arquivo muito grande (máx. 5MB)` };
    }
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const { data: existing } = await admin
    .from("client_creative_profile")
    .select("identity_sample_urls, identity_sample_storage_paths")
    .eq("client_id", clientId)
    .maybeSingle();

  const existingUrls = Array.isArray(existing?.identity_sample_urls)
    ? (existing.identity_sample_urls as string[])
    : [];
  const existingPaths = Array.isArray(existing?.identity_sample_storage_paths)
    ? (existing.identity_sample_storage_paths as string[])
    : [];

  const room = MAX_SAMPLES - existingUrls.length;
  if (room <= 0) {
    return { error: `Limite de ${MAX_SAMPLES} artes de referência atingido` };
  }
  const toUpload = files.slice(0, room);

  const uploadedUrls: string[] = [];
  const uploadedPaths: string[] = [];
  for (const file of toUpload) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${owned.userId}/${clientId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { upsert: true, contentType: file.type });
    if (uploadError) return { error: `Falha no upload de ${file.name}: ${uploadError.message}` };

    uploadedUrls.push(`${baseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`);
    uploadedPaths.push(storagePath);
  }

  const sampleUrls = [...existingUrls, ...uploadedUrls];
  const samplePaths = [...existingPaths, ...uploadedPaths];

  await upsertCreativeProfile(clientId, {
    identity_sample_urls: sampleUrls,
    identity_sample_storage_paths: samplePaths,
    identity_extraction_status: "extracting",
    identity_extraction_error: null,
    visual_identity_dna: null,
    identity_extracted_at: null,
  });

  after(() => runIdentityExtraction(clientId, sampleUrls));

  revalidatePath(`/clients/${clientId}/onboarding`);
  revalidatePath(`/clients/${clientId}`);

  return { success: true, sampleUrls, status: "extracting" };
}

export async function removeIdentitySampleAction(
  clientId: string,
  sampleUrl: string
): Promise<VisualIdentityActionState> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("client_creative_profile")
    .select("identity_sample_urls, identity_sample_storage_paths")
    .eq("client_id", clientId)
    .maybeSingle();

  const existingUrls = Array.isArray(existing?.identity_sample_urls)
    ? (existing.identity_sample_urls as string[])
    : [];
  const existingPaths = Array.isArray(existing?.identity_sample_storage_paths)
    ? (existing.identity_sample_storage_paths as string[])
    : [];

  const removeIndex = existingUrls.indexOf(sampleUrl);
  if (removeIndex === -1) return { error: "Amostra não encontrada" };

  const pathToRemove = existingPaths[removeIndex];
  if (pathToRemove) {
    await admin.storage.from(BUCKET).remove([pathToRemove]);
  }

  const nextUrls = existingUrls.filter((_, i) => i !== removeIndex);
  const nextPaths = existingPaths.filter((_, i) => i !== removeIndex);

  if (nextUrls.length === 0) {
    await upsertCreativeProfile(clientId, {
      identity_sample_urls: [],
      identity_sample_storage_paths: [],
      visual_identity_dna: null,
      identity_extracted_at: null,
      identity_extraction_status: "idle",
      identity_extraction_error: null,
      base_prompt: "",
      palette: [],
      style_reference_urls: [],
    });
    revalidatePath(`/clients/${clientId}/onboarding`);
    revalidatePath(`/clients/${clientId}`);
    return { success: true, sampleUrls: [], status: "idle" };
  }

  await upsertCreativeProfile(clientId, {
    identity_sample_urls: nextUrls,
    identity_sample_storage_paths: nextPaths,
    identity_extraction_status: "extracting",
    identity_extraction_error: null,
  });

  after(() => runIdentityExtraction(clientId, nextUrls));

  revalidatePath(`/clients/${clientId}/onboarding`);
  revalidatePath(`/clients/${clientId}`);

  return { success: true, sampleUrls: nextUrls, status: "extracting" };
}

export async function retryIdentityExtractionAction(
  clientId: string
): Promise<VisualIdentityActionState> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_creative_profile")
    .select("identity_sample_urls")
    .eq("client_id", clientId)
    .maybeSingle();

  const sampleUrls = Array.isArray(profile?.identity_sample_urls)
    ? (profile.identity_sample_urls as string[])
    : [];
  if (sampleUrls.length === 0) {
    return { error: "Nenhuma amostra enviada" };
  }

  await upsertCreativeProfile(clientId, {
    identity_extraction_status: "extracting",
    identity_extraction_error: null,
  });

  after(() => runIdentityExtraction(clientId, sampleUrls));

  revalidatePath(`/clients/${clientId}/onboarding`);

  return { success: true, status: "extracting" };
}

/**
 * Edita o DNA já extraído (cor, tipografia, etc.) sem reprocessar a imagem —
 * o `base_prompt` é só uma função determinística do DNA estruturado
 * (`buildBasePromptFromDna`), então editar os campos aqui já é a única forma
 * de mudar o prompt final; ele nunca é editado como texto solto.
 */
export async function updateVisualIdentityDnaAction(
  clientId: string,
  patch: Partial<VisualIdentityDna>
): Promise<VisualIdentityActionState> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_creative_profile")
    .select("visual_identity_dna, identity_extraction_status")
    .eq("client_id", clientId)
    .maybeSingle();

  if (profile?.identity_extraction_status !== "ready" || !profile.visual_identity_dna) {
    return { error: "Nenhum DNA extraído para editar" };
  }

  const merged = visualIdentityDnaSchema.safeParse({
    ...(profile.visual_identity_dna as object),
    ...patch,
  });
  if (!merged.success) {
    return { error: merged.error.issues[0]?.message ?? "DNA inválido" };
  }

  const basePrompt = buildBasePromptFromDna(merged.data);

  await upsertCreativeProfile(clientId, {
    visual_identity_dna: merged.data,
    base_prompt: basePrompt,
    palette: merged.data.palette,
  });

  revalidatePath(`/clients/${clientId}/onboarding`);
  revalidatePath(`/clients/${clientId}`);

  return { success: true, status: "ready" };
}

export async function syncLogoToCreativeProfile(
  clientId: string,
  logoUrl: string | null
): Promise<void> {
  await upsertCreativeProfile(clientId, { logo_url: logoUrl });
}
