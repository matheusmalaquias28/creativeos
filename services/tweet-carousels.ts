import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { TweetCarousel, TweetProfile } from "@/types/tweet-carousel";

export const getTweetProfilesForUser = cache(async (): Promise<TweetProfile[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tweet_profiles")
    .select("*")
    .order("updated_at", { ascending: false });
  return (data ?? []) as TweetProfile[];
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
