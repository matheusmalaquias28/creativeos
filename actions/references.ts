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

  const supabase = await createClient();
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  let uploaded = 0;

  const { count } = await supabase
    .from("client_references")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  let sortOrder = count ?? 0;

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { error: `Formato não suportado: ${file.name}` };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { error: `Arquivo muito grande: ${file.name} (máx. 10MB)` };
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${owned.userId}/${clientId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("client-references")
      .upload(storagePath, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      return { error: `Falha no upload: ${uploadError.message}` };
    }

    const publicUrl = `${baseUrl}/storage/v1/object/public/client-references/${storagePath}`;

    const { error: dbError } = await supabase.from("client_references").insert({
      client_id: clientId,
      storage_path: storagePath,
      public_url: publicUrl,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      sort_order: sortOrder,
    });

    if (dbError) {
      await supabase.storage.from("client-references").remove([storagePath]);
      return { error: dbError.message };
    }

    sortOrder += 1;
    uploaded += 1;
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/references`);

  return { success: true, uploaded };
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
