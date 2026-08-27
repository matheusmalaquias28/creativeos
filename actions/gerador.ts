"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";

export type GeradorImage = {
  id: string;
  user_id: string;
  url: string;
  aspect_ratio: string;
  resolution: string;
  prompt: string;
  created_at: string;
};

export async function loadGeradorImagesAction(): Promise<GeradorImage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gerador_image")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as GeradorImage[];
}

export async function saveGeradorImageAction(
  url: string,
  aspectRatio: string,
  resolution: string,
  prompt: string
): Promise<{ id: string } | { error: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "Não autenticado" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gerador_image")
    .insert({
      user_id: user.id,
      url,
      aspect_ratio: aspectRatio,
      resolution,
      prompt,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}

export async function deleteGeradorImageAction(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("gerador_image")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  return { success: true };
}
