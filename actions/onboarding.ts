"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema, type OnboardingFormValues, type ClientPhoto } from "@/lib/schemas/client";
import { getOwnedClient } from "@/lib/auth/verify-client";
import { buildLogoStoragePath } from "@/lib/utils/logo-filename";
import { isAllowedLogoFile, isSvgLogoFile } from "@/lib/utils/logo-file";
import { isOnboardingComplete } from "@/services/onboarding";

type StoredAnswers = Partial<OnboardingFormValues> & { clientPhotos?: ClientPhoto[] };

export type OnboardingActionState = {
  error?: string;
  success?: boolean;
  savedAt?: string;
};

export type LogoActionState = {
  error?: string;
  success?: boolean;
  logoUrl?: string;
  logoStoragePath?: string;
};

const LOGO_MAX_SIZE = 5 * 1024 * 1024;

function parseBrandColors(raw: FormDataEntryValue | null): string[] {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseFormToAnswers(formData: FormData): Partial<OnboardingFormValues> {
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();
  const logoStoragePath = String(formData.get("logoStoragePath") ?? "").trim();

  return {
    businessDescription: String(formData.get("businessDescription") ?? ""),
    targetAudience: String(formData.get("targetAudience") ?? ""),
    brandPersonality: String(formData.get("brandPersonality") ?? ""),
    competitors: String(formData.get("competitors") ?? "") || undefined,
    goals: String(formData.get("goals") ?? ""),
    toneOfVoice: String(formData.get("toneOfVoice") ?? ""),
    visualInspirations: String(formData.get("visualInspirations") ?? "") || undefined,
    avoidStyles: String(formData.get("avoidStyles") ?? "") || undefined,
    brandColors: parseBrandColors(formData.get("brandColors")),
    fontStyles: String(formData.get("fontStyles") ?? ""),
    logoUrl: logoUrl || undefined,
    logoStoragePath: logoStoragePath || undefined,
  };
}

async function mergeWithExistingAnswers(
  clientId: string,
  incoming: Partial<OnboardingFormValues>
): Promise<StoredAnswers> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("onboarding_answers")
    .select("answers")
    .eq("client_id", clientId)
    .maybeSingle();

  const existing =
    data?.answers && typeof data.answers === "object"
      ? (data.answers as StoredAnswers)
      : {};

  return {
    ...existing,
    ...incoming,
    logoUrl: incoming.logoUrl ?? existing.logoUrl,
    logoStoragePath: incoming.logoStoragePath ?? existing.logoStoragePath,
    clientPhotos: existing.clientPhotos,
  };
}

async function persistAnswers(
  clientId: string,
  answers: StoredAnswers,
  completedAt?: string | null
): Promise<OnboardingActionState> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("onboarding_answers")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing) {
    const payload: { answers: StoredAnswers; completed_at?: string | null } = {
      answers,
    };
    if (completedAt !== undefined) payload.completed_at = completedAt;

    const { error } = await supabase
      .from("onboarding_answers")
      .update(payload)
      .eq("client_id", clientId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("onboarding_answers").insert({
      client_id: clientId,
      answers,
      completed_at: completedAt ?? null,
    });
    if (error) return { error: error.message };
  }

  if (owned.client.status === "draft") {
    await supabase.from("clients").update({ status: "onboarding" }).eq("id", clientId);
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/onboarding`);

  return { success: true, savedAt: new Date().toISOString() };
}

export async function saveOnboardingDraft(
  clientId: string,
  answers: Partial<OnboardingFormValues>
): Promise<OnboardingActionState> {
  const merged = await mergeWithExistingAnswers(clientId, answers);
  return persistAnswers(clientId, merged);
}

export async function saveOnboardingAction(
  clientId: string,
  _prev: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const answers = parseFormToAnswers(formData);
  const merged = await mergeWithExistingAnswers(clientId, answers);
  return persistAnswers(clientId, merged);
}

export async function completeOnboardingAction(
  clientId: string,
  _prev: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const answers = await mergeWithExistingAnswers(
    clientId,
    parseFormToAnswers(formData)
  );
  const parsed = onboardingSchema.safeParse(answers);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Preencha todos os campos obrigatórios",
    };
  }

  if (!isOnboardingComplete(parsed.data)) {
    return { error: "Complete todos os campos obrigatórios antes de finalizar" };
  }

  const now = new Date().toISOString();
  await persistAnswers(clientId, parsed.data, now);

  const supabase = await createClient();
  await supabase.from("clients").update({ status: "onboarding" }).eq("id", clientId);

  return { success: true, savedAt: now };
}

export async function uploadClientLogoAction(
  clientId: string,
  formData: FormData
): Promise<LogoActionState> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo de logo" };
  }
  if (isSvgLogoFile(file)) {
    return {
      error:
        "SVG não é suportado (incompatível com análise visual). Use PNG, JPG ou WebP.",
    };
  }
  if (!isAllowedLogoFile(file)) {
    return { error: "Formato não suportado. Use PNG, JPG ou WebP" };
  }
  if (file.size > LOGO_MAX_SIZE) {
    return { error: "Logo muito grande (máx. 5MB)" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const storagePath = buildLogoStoragePath(
    owned.userId,
    clientId,
    owned.client.name,
    ext
  );
  const supabase = await createClient();
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const { data: existing } = await supabase
    .from("onboarding_answers")
    .select("answers")
    .eq("client_id", clientId)
    .maybeSingle();

  const prevAnswers =
    existing?.answers && typeof existing.answers === "object"
      ? (existing.answers as Partial<OnboardingFormValues>)
      : {};

  if (prevAnswers.logoStoragePath) {
    await supabase.storage
      .from("client-logos")
      .remove([prevAnswers.logoStoragePath]);
  }

  const { error: uploadError } = await supabase.storage
    .from("client-logos")
    .upload(storagePath, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { error: `Falha no upload: ${uploadError.message}` };
  }

  const logoUrl = `${baseUrl}/storage/v1/object/public/client-logos/${storagePath}`;
  const merged = {
    ...prevAnswers,
    logoUrl,
    logoStoragePath: storagePath,
  };

  await persistAnswers(clientId, merged);

  return { success: true, logoUrl, logoStoragePath: storagePath };
}

const PHOTO_MAX_SIZE = 2 * 1024 * 1024;
const PHOTO_MAX_COUNT = 5;

export async function uploadClientPhotoAction(
  clientId: string,
  formData: FormData
): Promise<{ error?: string; photo?: { url: string; storagePath: string } }> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo" };
  }
  if (!isAllowedLogoFile(file)) {
    return { error: "Use PNG, JPG ou WebP" };
  }
  if (file.size > PHOTO_MAX_SIZE) {
    return { error: "Foto muito grande (máx. 10MB)" };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("onboarding_answers")
    .select("answers")
    .eq("client_id", clientId)
    .maybeSingle();

  const prevAnswers =
    existing?.answers && typeof existing.answers === "object"
      ? (existing.answers as StoredAnswers)
      : {};

  const currentPhotos = Array.isArray(prevAnswers.clientPhotos)
    ? prevAnswers.clientPhotos
    : [];

  if (currentPhotos.length >= PHOTO_MAX_COUNT) {
    return { error: `Máximo de ${PHOTO_MAX_COUNT} fotos por cliente` };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${owned.userId}/${clientId}/photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const { error: uploadError } = await supabase.storage
    .from("client-photos")
    .upload(storagePath, file, { upsert: false, contentType: file.type });

  if (uploadError) return { error: `Falha no upload: ${uploadError.message}` };

  const url = `${baseUrl}/storage/v1/object/public/client-photos/${storagePath}`;
  const photo = { url, storagePath };
  const merged = {
    ...prevAnswers,
    clientPhotos: [...currentPhotos, photo],
  };

  await persistAnswers(clientId, merged);
  revalidatePath(`/clients/${clientId}/references`);

  return { photo };
}

export async function removeClientPhotoAction(
  clientId: string,
  storagePath: string
): Promise<{ error?: string; success?: boolean }> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("onboarding_answers")
    .select("answers")
    .eq("client_id", clientId)
    .maybeSingle();

  const prevAnswers =
    existing?.answers && typeof existing.answers === "object"
      ? (existing.answers as StoredAnswers)
      : {};

  await supabase.storage.from("client-photos").remove([storagePath]);

  const filtered = (prevAnswers.clientPhotos ?? []).filter(
    (p) => p.storagePath !== storagePath
  );
  await persistAnswers(clientId, { ...prevAnswers, clientPhotos: filtered });
  revalidatePath(`/clients/${clientId}/references`);
  revalidatePath(`/clients/${clientId}/onboarding`);

  return { success: true };
}

export async function removeClientLogoAction(
  clientId: string
): Promise<LogoActionState> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("onboarding_answers")
    .select("answers")
    .eq("client_id", clientId)
    .maybeSingle();

  const prevAnswers =
    existing?.answers && typeof existing.answers === "object"
      ? (existing.answers as Partial<OnboardingFormValues>)
      : {};

  if (prevAnswers.logoStoragePath) {
    await supabase.storage
      .from("client-logos")
      .remove([prevAnswers.logoStoragePath]);
  }

  const { logoUrl: _u, logoStoragePath: _p, ...rest } = prevAnswers;
  await persistAnswers(clientId, rest);

  return { success: true };
}
