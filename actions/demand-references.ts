"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export type DemandReferenceActionState = {
  error?: string;
  success?: boolean;
  uploaded?: number;
};

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export async function uploadDemandReferencesAction(
  demandId: string,
  _prev: DemandReferenceActionState,
  formData: FormData
): Promise<DemandReferenceActionState> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return { error: "Selecione ao menos uma imagem" };

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) return { error: `Formato não suportado: ${file.name}` };
    if (file.size > MAX_FILE_SIZE) return { error: `Arquivo muito grande: ${file.name} (máx. 10MB)` };
  }

  const { count } = await supabase
    .from("demand_reference_image")
    .select("id", { count: "exact", head: true })
    .eq("demand_id", demandId);

  const positionBase = count ?? 0;
  const timestamp = Date.now();

  const uploads = await Promise.all(
    files.map(async (file, idx) => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${demandId}/${timestamp}-${idx}-${safeName}`;
      const bytes = await file.arrayBuffer();
      const { error } = await supabase.storage
        .from("demand-references")
        .upload(storagePath, bytes, { upsert: false, contentType: file.type });
      return { file, storagePath, error };
    })
  );

  const failed = uploads.find((u) => u.error);
  if (failed) {
    const uploaded = uploads.filter((u) => !u.error).map((u) => u.storagePath);
    if (uploaded.length > 0) await supabase.storage.from("demand-references").remove(uploaded);
    return { error: `Falha no upload: ${failed.error!.message}` };
  }

  // Gera URLs assinadas de longa duração (1 ano) para uso interno
  const admin = createAdminClient();
  const inserts = await Promise.all(
    uploads.map(async (u, idx) => {
      const { data } = await admin.storage
        .from("demand-references")
        .createSignedUrl(u.storagePath, 60 * 60 * 24 * 365);
      return {
        demand_id: demandId,
        storage_path: u.storagePath,
        storage_url: data?.signedUrl ?? "",
        file_name: u.file.name,
        mime_type: u.file.type,
        file_size: u.file.size,
        position: positionBase + idx,
      };
    })
  );

  const { error: dbError } = await supabase.from("demand_reference_image").insert(inserts);
  if (dbError) {
    await supabase.storage.from("demand-references").remove(uploads.map((u) => u.storagePath));
    return { error: dbError.message };
  }

  revalidatePath(`/demands/${demandId}`);
  return { success: true, uploaded: uploads.length };
}

// ---------------------------------------------------------------------------
// Update role
// ---------------------------------------------------------------------------

export async function updateDemandReferenceRoleAction(
  referenceId: string,
  role: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("demand_reference_image")
    .update({ role: role || null })
    .eq("id", referenceId);
  if (error) return { error: error.message };
  return {};
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteDemandReferenceAction(
  demandId: string,
  referenceId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: ref } = await supabase
    .from("demand_reference_image")
    .select("storage_path")
    .eq("id", referenceId)
    .eq("demand_id", demandId)
    .single();

  if (!ref) return { error: "Referência não encontrada" };

  await supabase.storage.from("demand-references").remove([ref.storage_path]);
  const { error } = await supabase.from("demand_reference_image").delete().eq("id", referenceId);
  if (error) return { error: error.message };

  revalidatePath(`/demands/${demandId}`);
  return {};
}
