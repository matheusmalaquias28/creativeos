"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/ai/client";
import { stripTravessao } from "@/lib/text/strip-dash";
import type { CarouselProfileDraft } from "@/types/carousel-profile";

export type ProfileActionState = {
  error?: string;
  success?: boolean;
  profileId?: string;
};

export type ContextActionState = {
  error?: string;
  md?: string;
};

/** Turn the raw business/brand notes into a structured markdown context. */
export async function generateProfileContextAction(
  input: string,
  name: string
): Promise<ContextActionState> {
  const raw = input.trim();
  if (!raw) return { error: "Escreva algumas informações sobre o cliente primeiro" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  try {
    const anthropic = getAnthropicClient();
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `Você é um estrategista de marca. A partir das anotações abaixo sobre o cliente "${name}", escreva um documento de contexto em Markdown, conciso e objetivo, que sirva de briefing para gerar carrosséis de Instagram.

Anotações:
"""
${raw}
"""

Estruture com estas seções (use títulos ##):
## Negócio (o que é, para quem, proposta de valor)
## Tom de comunicação (como a marca fala, adjetivos, o que evitar)
## Temas e ângulos (assuntos que fazem sentido para a marca)
## Diretrizes de conteúdo (regras práticas para os textos dos carrosséis)

IMPORTANTE: nunca use travessão (— ou –) no texto; use vírgula ou ponto.
Responda APENAS com o Markdown, sem comentários extras.`,
        },
      ],
    });

    const text = msg.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return { error: "Sem resposta da IA" };
    return { md: stripTravessao(text.text.trim()) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao gerar contexto" };
  }
}

function draftToRow(draft: CarouselProfileDraft) {
  return {
    client_id: draft.client_id,
    name: draft.name?.trim() || "Novo Perfil",
    logo_url: draft.logo_url,
    logo_storage_path: draft.logo_storage_path,
    font_title: draft.font_title,
    font_body: draft.font_body,
    color_background: draft.color_background,
    color_title: draft.color_title,
    color_subtitle: draft.color_subtitle,
    color_accent: draft.color_accent,
    palette: draft.palette ?? [],
    instagram_handle: draft.instagram_handle,
    business_context: draft.business_context,
    context_md: draft.context_md,
  };
}

export async function saveCarouselProfileAction(
  draft: CarouselProfileDraft
): Promise<ProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const row = draftToRow(draft);

  if (draft.id) {
    const { error } = await supabase
      .from("carousel_profiles")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", draft.id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    revalidatePath("/carousel/perfis");
    return { success: true, profileId: draft.id };
  }

  const { data, error } = await supabase
    .from("carousel_profiles")
    .insert({ ...row, user_id: user.id })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Erro ao criar perfil" };

  revalidatePath("/carousel/perfis");
  return { success: true, profileId: data.id };
}

export async function deleteCarouselProfileAction(
  id: string
): Promise<ProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase
    .from("carousel_profiles")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/carousel/perfis");
  return { success: true };
}
