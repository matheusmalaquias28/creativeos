"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CATEGORY_META,
  MAX_REFERENCES_PER_ARTE,
  isReferenceCategory,
  type ReferenceCategory,
} from "@/lib/image-library/categories";
import { bumpLibraryImageUsage } from "@/services/image-library";

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
    .select("storage_path, library_image_id")
    .eq("id", referenceId)
    .eq("demand_id", demandId)
    .single();

  if (!ref) return { error: "Referência não encontrada" };

  // Imagem do acervo: o arquivo pertence ao acervo (bucket image-library) e
  // pode estar em outras demandas — só a ligação com a arte é removida.
  if (!ref.library_image_id) {
    await supabase.storage.from("demand-references").remove([ref.storage_path]);
  }
  const { error } = await supabase.from("demand_reference_image").delete().eq("id", referenceId);
  if (error) return { error: error.message };

  revalidatePath(`/demands/${demandId}`);
  return {};
}

// ---------------------------------------------------------------------------
// Acervo → arte
// ---------------------------------------------------------------------------

export type ArteReference = {
  id: string;
  storage_url: string;
  file_name: string;
  arte_index: number;
  category: ReferenceCategory;
};

/**
 * Liga uma imagem do acervo a uma arte da demanda, com a categoria de uso. A
 * linha aponta para a URL pública do acervo — nada é copiado; o
 * generate-space.ts sobe essa URL no Space e menciona o node no prompt.
 */
export async function addLibraryImageToArteAction(input: {
  demandId: string;
  arteIndex: number;
  libraryImageId: string;
  category: string;
}): Promise<{ error?: string; reference?: ArteReference }> {
  const { demandId, arteIndex, libraryImageId, category } = input;
  if (!isReferenceCategory(category)) return { error: "Categoria inválida" };
  if (!Number.isInteger(arteIndex) || arteIndex < 0) return { error: "Arte inválida" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: image } = await supabase
    .from("image_library")
    .select("id, storage_url, storage_path, file_name")
    .eq("id", libraryImageId)
    .eq("active", true)
    .maybeSingle();
  if (!image) return { error: "Imagem não encontrada no acervo" };

  const { data: existing } = await supabase
    .from("demand_reference_image")
    .select("id, library_image_id, category, arte_index, position")
    .eq("demand_id", demandId);

  const rows = existing ?? [];
  const arteRows = rows.filter((r) => r.arte_index === arteIndex);

  const duplicate = arteRows.find(
    (r) => r.library_image_id === libraryImageId && r.category === category
  );
  if (duplicate) return { error: `Essa imagem já está na arte como ${CATEGORY_META[category].short}` };

  if (arteRows.length >= MAX_REFERENCES_PER_ARTE) {
    return { error: `Máximo de ${MAX_REFERENCES_PER_ARTE} imagens do acervo por arte` };
  }

  const position = rows.reduce((max, r) => Math.max(max, r.position ?? 0), -1) + 1;
  const fileName = image.file_name ?? "acervo";

  const { data: inserted, error } = await supabase
    .from("demand_reference_image")
    .insert({
      demand_id: demandId,
      storage_path: image.storage_path,
      storage_url: image.storage_url,
      file_name: fileName,
      role: CATEGORY_META[category].label,
      position,
      arte_index: arteIndex,
      category,
      library_image_id: image.id,
    })
    .select("id")
    .single();

  if (error || !inserted) return { error: error?.message ?? "Falha ao adicionar" };

  await bumpLibraryImageUsage(image.id);
  revalidatePath(`/demands/${demandId}`);

  return {
    reference: {
      id: inserted.id,
      storage_url: image.storage_url,
      file_name: fileName,
      arte_index: arteIndex,
      category,
    },
  };
}

export async function updateArteReferenceCategoryAction(
  demandId: string,
  referenceId: string,
  category: string
): Promise<{ error?: string }> {
  if (!isReferenceCategory(category)) return { error: "Categoria inválida" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("demand_reference_image")
    .update({ category, role: CATEGORY_META[category].label })
    .eq("id", referenceId)
    .eq("demand_id", demandId);
  if (error) return { error: error.message };

  revalidatePath(`/demands/${demandId}`);
  return {};
}
