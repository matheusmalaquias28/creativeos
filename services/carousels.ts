import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Carousel } from "@/types/carousel";

export const getCarouselsForUser = cache(async (): Promise<Carousel[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("carousels")
    .select("*")
    .order("updated_at", { ascending: false });
  return (data ?? []) as Carousel[];
});

export const getCarouselById = cache(
  async (id: string): Promise<Carousel | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("carousels")
      .select("*")
      .eq("id", id)
      .single();
    return (data ?? null) as Carousel | null;
  }
);
