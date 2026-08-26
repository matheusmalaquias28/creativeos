"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getOwnedClient } from "@/lib/auth/verify-client";
import {
  buildBasePromptFromDna,
  extractVisualIdentityFromImage,
} from "@/lib/ai/extract-visual-identity";
import { upsertCreativeProfile } from "@/services/art-gen";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const BUCKET = "client-identity-samples";

export type VisualIdentityActionState = {
  error?: string;
  success?: boolean;
  sampleUrl?: string;
  status?: string;
};

async function runIdentityExtraction(clientId: string, sampleUrl: string): Promise<void> {
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

    const dna = await extractVisualIdentityFromImage(sampleUrl, client?.name ?? undefined);
    const basePrompt = buildBasePromptFromDna(dna);
    const now = new Date().toISOString();

    await upsertCreativeProfile(clientId, {
      identity_sample_url: sampleUrl,
      visual_identity_dna: dna,
      identity_extracted_at: now,
      identity_extraction_status: "ready",
      identity_extraction_error: null,
      base_prompt: basePrompt,
      palette: dna.palette,
      style_reference_urls: [sampleUrl],
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

  const file = formData.get("sample");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione uma arte de referência" };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "Use PNG, JPG ou WebP" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "Arquivo muito grande (máx. 5MB)" };
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const { data: existing } = await admin
    .from("client_creative_profile")
    .select("identity_sample_storage_path")
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing?.identity_sample_storage_path) {
    await supabase.storage
      .from(BUCKET)
      .remove([existing.identity_sample_storage_path]);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${owned.userId}/${clientId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: true, contentType: file.type });

  if (uploadError) return { error: `Falha no upload: ${uploadError.message}` };

  const sampleUrl = `${baseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;

  await upsertCreativeProfile(clientId, {
    identity_sample_url: sampleUrl,
    identity_sample_storage_path: storagePath,
    identity_extraction_status: "extracting",
    identity_extraction_error: null,
    visual_identity_dna: null,
    identity_extracted_at: null,
  });

  after(() => runIdentityExtraction(clientId, sampleUrl));

  revalidatePath(`/clients/${clientId}/onboarding`);
  revalidatePath(`/clients/${clientId}`);

  return { success: true, sampleUrl, status: "extracting" };
}

export async function removeIdentitySampleAction(
  clientId: string
): Promise<VisualIdentityActionState> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("client_creative_profile")
    .select("identity_sample_storage_path")
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing?.identity_sample_storage_path) {
    await admin.storage.from(BUCKET).remove([existing.identity_sample_storage_path]);
  }

  await upsertCreativeProfile(clientId, {
    identity_sample_url: null,
    identity_sample_storage_path: null,
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

  return { success: true, status: "idle" };
}

export async function retryIdentityExtractionAction(
  clientId: string
): Promise<VisualIdentityActionState> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_creative_profile")
    .select("identity_sample_url")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!profile?.identity_sample_url) {
    return { error: "Nenhuma amostra enviada" };
  }

  await upsertCreativeProfile(clientId, {
    identity_extraction_status: "extracting",
    identity_extraction_error: null,
  });

  after(() => runIdentityExtraction(clientId, profile.identity_sample_url!));

  revalidatePath(`/clients/${clientId}/onboarding`);

  return { success: true, status: "extracting" };
}

export async function syncLogoToCreativeProfile(
  clientId: string,
  logoUrl: string | null
): Promise<void> {
  await upsertCreativeProfile(clientId, { logo_url: logoUrl });
}
