"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { makeDefaultSlide } from "@/types/carousel";
import type { Carousel, CarouselFormat } from "@/types/carousel";

export type CarouselActionState = {
  error?: string;
  success?: boolean;
  carouselId?: string;
};

export async function createCarouselAction(
  _: CarouselActionState,
  formData: FormData
): Promise<CarouselActionState> {
  const name = (formData.get("name") as string)?.trim() || "Novo Carrossel";
  const format = (formData.get("format") as CarouselFormat) || "carousel";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data, error } = await supabase
    .from("carousels")
    .insert({
      user_id: user.id,
      name,
      format,
      slides: [makeDefaultSlide()],
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Erro ao criar carrossel" };

  revalidatePath("/carousel");
  redirect(`/carousel/${data.id}`);
}

export async function saveCarouselAction(
  carousel: Carousel
): Promise<CarouselActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase
    .from("carousels")
    .update({
      name: carousel.name,
      format: carousel.format,
      post_style: carousel.post_style,
      slides: carousel.slides,
      design: carousel.design ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq("id", carousel.id)
    .eq("user_id", user.id);

  if (error) return { error: "Erro ao salvar" };

  revalidatePath("/carousel");
  revalidatePath(`/carousel/${carousel.id}`);
  return { success: true };
}

export async function deleteCarouselAction(
  id: string
): Promise<CarouselActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase
    .from("carousels")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Erro ao deletar" };

  revalidatePath("/carousel");
  return { success: true };
}
