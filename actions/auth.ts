"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/schemas/auth";
import { canAccessPath, homePathFor, parseRole } from "@/lib/auth/permissions";

export type AuthActionState = {
  error?: string;
  success?: string;
};

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "E-mail ou senha incorretos" };
  }

  const role = parseRole(data.user?.app_metadata?.role);
  const requested = formData.get("redirectTo")?.toString() ?? "";
  const safe = requested.startsWith("/") && !requested.startsWith("//") && canAccessPath(role, requested);
  redirect(safe ? requested : homePathFor(role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
