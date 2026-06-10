"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOwnedClient } from "@/lib/auth/verify-client";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export type ReferenceActionState = {
  error?: string;
  success?: boolean;
  uploaded?: number;
};

export async function uploadReferencesAction(
  clientId: string,
  _prev: ReferenceActionState,
  formData: FormData
): Promise<ReferenceActionState> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return { error: "Selecione ao menos uma imagem" };

  // Validate all files upfront before any upload
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { error: `Formato não suportado: ${file.name}` };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { error: `Arquivo muito grande: ${file.name} (máx. 10MB)` };
    }
  }

  const supabase = await createClient();
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const { count } = await supabase
    .from("client_references")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  const sortBase = count ?? 0;
  const timestamp = Date.now();

  // Upload all files to storage in parallel
  const uploads = await Promise.all(
    files.map(async (file, idx) => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${owned.userId}/${clientId}/${timestamp}-${idx}-${safeName}`;
      const { error } = await supabase.storage
        .from("client-references")
        .upload(storagePath, file, { upsert: false, contentType: file.type });
      return { file, storagePath, error };
    })
  );

  const failed = uploads.find((u) => u.error);
  if (failed) {
    const uploaded = uploads.filter((u) => !u.error).map((u) => u.storagePath);
    if (uploaded.length > 0) {
      await supabase.storage.from("client-references").remove(uploaded);
    }
    return { error: `Falha no upload: ${failed.error!.message}` };
  }

  // Batch insert all DB records in a single query
  const inserts = uploads.map((u, idx) => ({
    client_id: clientId,
    storage_path: u.storagePath,
    public_url: `${baseUrl}/storage/v1/object/public/client-references/${u.storagePath}`,
    file_name: u.file.name,
    mime_type: u.file.type,
    file_size: u.file.size,
    sort_order: sortBase + idx,
  }));

  const { error: dbError } = await supabase.from("client_references").insert(inserts);
  if (dbError) {
    await supabase.storage
      .from("client-references")
      .remove(uploads.map((u) => u.storagePath));
    return { error: dbError.message };
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/references`);

  return { success: true, uploaded: uploads.length };
}

export async function deleteReferenceAction(
  clientId: string,
  referenceId: string
): Promise<{ error?: string; success?: boolean }> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const supabase = await createClient();
  const { data: ref } = await supabase
    .from("client_references")
    .select("storage_path")
    .eq("id", referenceId)
    .eq("client_id", clientId)
    .single();

  if (!ref) return { error: "Referência não encontrada" };

  await supabase.storage.from("client-references").remove([ref.storage_path]);
  const { error } = await supabase
    .from("client_references")
    .delete()
    .eq("id", referenceId);

  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/references`);

  return { success: true };
}
