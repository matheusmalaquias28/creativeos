"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/session";
import { persistImageFromUrl } from "@/lib/images/persist-image";

export type GeradorImage = {
  id: string;
  user_id: string | null;
  url: string;
  aspect_ratio: string;
  resolution: string;
  prompt: string;
  created_at: string;
};

export async function loadGeradorImagesAction(): Promise<GeradorImage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("generated_images")
    .select("id, user_id, url, aspect_ratio, resolution, prompt, created_at")
    .eq("source", "gerador")
    .order("created_at", { ascending: false });
  return (data ?? []) as GeradorImage[];
}

export async function saveGeradorImageAction(
  url: string,
  aspectRatio: string,
  resolution: string,
  prompt: string
): Promise<{ id: string | null; url: string } | { error: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "Não autenticado" };

  // A URL da Magnific expira — baixa e persiste no Storage antes de salvar.
  const persisted = await persistImageFromUrl({
    url,
    source: "gerador",
    userId: user.id,
    prompt,
    aspectRatio,
    resolution,
  });

  return { id: persisted.id, url: persisted.url };
}

export async function deleteGeradorImageAction(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("generated_images")
    .delete()
    .eq("id", id)
    .select("storage_path")
    .single();

  if (error) return { error: error.message };

  if (row?.storage_path) {
    const admin = createAdminClient();
    await admin.storage.from("generated-images").remove([row.storage_path]);
  }
  return { success: true };
}
