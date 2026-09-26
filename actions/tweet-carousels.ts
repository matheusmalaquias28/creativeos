"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeHandle, type TweetProfile } from "@/types/tweet-carousel";

export type TweetActionState = {
  error?: string;
  success?: boolean;
  profile?: TweetProfile;
};

export async function createTweetProfileAction(input: {
  name: string;
  handle: string;
  avatarUrl: string | null;
}): Promise<TweetActionState> {
  const name = input.name.trim();
  const handle = normalizeHandle(input.handle);
  if (!name) return { error: "Informe o nome do perfil" };
  if (!handle) return { error: "Informe o @ do perfil" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data, error } = await supabase
    .from("tweet_profiles")
    .insert({ user_id: user.id, name, handle, avatar_url: input.avatarUrl })
    .select("*")
    .single();

  if (error || !data) return { error: "Erro ao criar o perfil" };

  revalidatePath("/carousel");
  return { success: true, profile: data as TweetProfile };
}

export async function deleteTweetProfileAction(id: string): Promise<TweetActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase
    .from("tweet_profiles")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Erro ao excluir o perfil" };

  revalidatePath("/carousel");
  return { success: true };
}

export async function deleteTweetCarouselAction(id: string): Promise<TweetActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase
    .from("tweet_carousels")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Erro ao excluir" };

  revalidatePath("/carousel");
  return { success: true };
}
