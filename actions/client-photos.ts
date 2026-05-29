"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOwnedClient } from "@/lib/auth/verify-client";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_COUNT = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadClientPhotoAction(
  clientId: string,
  formData: FormData
): Promise<{ error?: string; photo?: { id: string; public_url: string; storage_path: string } }> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo" };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "Use PNG, JPG ou WebP" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "Foto muito grande (máx. 2MB)" };
  }

  const supabase = await createClient();

  const { count } = await supabase
    .from("client_photos")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  if ((count ?? 0) >= MAX_COUNT) {
    return { error: `Máximo de ${MAX_COUNT} fotos por cliente` };
  }

  const sortOrder = count ?? 0;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${owned.userId}/${clientId}/${Date.now()}-${safeName}`;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const { error: uploadError } = await supabase.storage
    .from("client-photos")
    .upload(storagePath, file, { upsert: false, contentType: file.type });

  if (uploadError) return { error: `Falha no upload: ${uploadError.message}` };

  const publicUrl = `${baseUrl}/storage/v1/object/public/client-photos/${storagePath}`;

  const { data, error: dbError } = await supabase
    .from("client_photos")
    .insert({
      client_id: clientId,
      storage_path: storagePath,
      public_url: publicUrl,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      sort_order: sortOrder,
    })
    .select("id, public_url, storage_path")
    .single();

  if (dbError) {
    await supabase.storage.from("client-photos").remove([storagePath]);
    return { error: dbError.message };
  }

  revalidatePath(`/clients/${clientId}/references`);
  revalidatePath(`/clients/${clientId}/onboarding`);

  return { photo: data };
}

export async function deleteClientPhotoAction(
  clientId: string,
  photoId: string
): Promise<{ error?: string; success?: boolean }> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("client_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("client_id", clientId)
    .single();

  if (!photo) return { error: "Foto não encontrada" };

  await supabase.storage.from("client-photos").remove([photo.storage_path]);
  const { error } = await supabase
    .from("client_photos")
    .delete()
    .eq("id", photoId);

  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}/references`);
  revalidatePath(`/clients/${clientId}/onboarding`);

  return { success: true };
}
