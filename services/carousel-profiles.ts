import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CarouselProfile } from "@/types/carousel-profile";

export const getCarouselProfilesForUser = cache(
  async (): Promise<CarouselProfile[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("carousel_profiles")
      .select("*")
      .order("updated_at", { ascending: false });
    return (data ?? []) as CarouselProfile[];
  }
);

export const getCarouselProfileById = cache(
  async (id: string): Promise<CarouselProfile | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("carousel_profiles")
      .select("*")
      .eq("id", id)
      .single();
    return (data ?? null) as CarouselProfile | null;
  }
);
