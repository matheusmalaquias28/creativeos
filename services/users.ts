import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";
import type { User, UserRole } from "@/types";

function resolveRole(appMetadata: Record<string, unknown> | undefined): UserRole {
  return appMetadata?.role === "admin" ? "admin" : "member";
}

/**
 * Garante que existe linha em public.users para o usuário autenticado.
 * Necessário quando o usuário foi criado no Auth antes do trigger ou via seed/API.
 */
export async function ensureUserProfile(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) return null;

  const fullName =
    (authUser.user_metadata?.full_name as string | undefined) ??
    (authUser.user_metadata?.name as string | undefined) ??
    null;

  const { error } = await supabase.from("users").upsert(
    {
      id: authUser.id,
      email: authUser.email,
      full_name: fullName,
      avatar_url: (authUser.user_metadata?.avatar_url as string | undefined) ?? null,
      role: resolveRole(authUser.app_metadata as Record<string, unknown> | undefined),
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  if (error) {
    throw new Error(`Não foi possível criar o perfil: ${error.message}`);
  }

  return authUser.id;
}

export const getCurrentUserProfile = cache(async (): Promise<User | null> => {
  const authUser = await getAuthUser();
  if (!authUser) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (data) return data;

  if (error) {
    await ensureUserProfile().catch(() => null);
    const { data: retry } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();
    return retry ?? null;
  }

  return null;
});
