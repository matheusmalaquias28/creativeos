import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  designProfileToTweetProfile,
  type TweetCarousel,
  type TweetProfile,
} from "@/types/tweet-carousel";

export const getTweetProfilesForUser = cache(async (): Promise<TweetProfile[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tweet_profiles")
    .select("*")
    .order("updated_at", { ascending: false });
  return (data ?? []) as TweetProfile[];
});

/** Perfis de design (Carrossel Avançado) usáveis no carrossel tweet: logo, nome e @. */
export const getDesignProfilesAsTweetProfiles = cache(async (): Promise<TweetProfile[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("carousel_profiles")
    .select("id, user_id, name, logo_url, instagram_avatar_url, instagram_handle, created_at, updated_at")
    .order("updated_at", { ascending: false });
  return (data ?? []).map(designProfileToTweetProfile);
});

export const getTweetCarouselsForUser = cache(async (): Promise<TweetCarousel[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tweet_carousels")
    .select("*")
    .order("updated_at", { ascending: false });
  return (data ?? []) as unknown as TweetCarousel[];
});

export const getTweetCarouselById = cache(
  async (id: string): Promise<TweetCarousel | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("tweet_carousels")
      .select("*")
      .eq("id", id)
      .single();
    return (data ?? null) as unknown as TweetCarousel | null;
  }
);
