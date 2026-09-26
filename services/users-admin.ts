import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/session";
import { parseRole, type AppRole } from "@/lib/auth/permissions";

export type ManagedUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  disabled: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

/** Garante que quem chama é super admin. Retorna o id dele ou null. */
export async function getSuperAdminId(): Promise<string | null> {
  const user = await getAuthUser();
  if (!user) return null;
  return parseRole(user.app_metadata?.role) === "super_admin" ? user.id : null;
}

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const admin = createAdminClient();
  const [{ data: authData, error }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("users").select("id, full_name"),
  ]);
  if (error) throw new Error(error.message);

  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  return authData.users
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      fullName:
        names.get(u.id) ?? (u.user_metadata?.full_name as string | undefined) ?? null,
      role: parseRole(u.app_metadata?.role),
      disabled: !!u.banned_until && new Date(u.banned_until).getTime() > Date.now(),
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
    }))
    .sort((a, b) => {
      if (a.role === "super_admin" && b.role !== "super_admin") return -1;
      if (b.role === "super_admin" && a.role !== "super_admin") return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
}
