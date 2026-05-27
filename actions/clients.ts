"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClientSchema } from "@/lib/schemas/client";
import { slugify } from "@/lib/utils/slug";
import { ensureUserProfile } from "@/services/users";

export type ClientActionState = {
  error?: string;
  success?: boolean;
  clientId?: string;
};

export async function createClientAction(
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const parsed = createClientSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Não autenticado" };
  }

  try {
    await ensureUserProfile();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao sincronizar perfil";
    return { error: message };
  }

  const baseSlug = slugify(parsed.data.name);
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .eq("slug", slug)
      .maybeSingle();

    if (!existing) break;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      slug,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/clients");

  return { success: true, clientId: data.id };
}
