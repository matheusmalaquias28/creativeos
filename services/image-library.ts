import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type LibraryImage = Database["public"]["Tables"]["image_library"]["Row"];

const LIST_LIMIT = 1000;

export async function listLibraryImages(): Promise<LibraryImage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("image_library")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryImage[];
}

/** Incrementa o uso — ajuda a ver no acervo o que já foi muito usado. */
export async function bumpLibraryImageUsage(imageId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("image_library")
    .select("usage_count")
    .eq("id", imageId)
    .maybeSingle();
  if (!data) return;

  await supabase
    .from("image_library")
    .update({ usage_count: (data.usage_count ?? 0) + 1, last_used_at: new Date().toISOString() })
    .eq("id", imageId);
}
