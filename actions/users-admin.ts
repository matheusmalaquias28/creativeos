"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSIGNABLE_ROLES, parseRole } from "@/lib/auth/permissions";
import { getSuperAdminId } from "@/services/users-admin";

export type UserAdminState = { error?: string; success?: boolean };

const passwordSchema = z
  .string()
  .min(8, "A senha precisa de pelo menos 8 caracteres")
  .max(72, "Senha muito longa");

const createSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome").max(80),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: passwordSchema,
  role: z.enum(ASSIGNABLE_ROLES, { message: "Selecione uma permissão" }),
});

const updateSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome").max(80),
  role: z.enum(ASSIGNABLE_ROLES, { message: "Selecione uma permissão" }),
  password: z.union([z.literal(""), passwordSchema]).optional(),
});

const NOT_ALLOWED = { error: "Apenas o super administrador pode gerenciar usuários" };

function firstIssue(err: z.ZodError) {
  return err.issues[0]?.message ?? "Dados inválidos";
}

/** Busca o alvo e bloqueia ações sobre si mesmo ou sobre outro super admin. */
async function loadTarget(id: string, selfId: string) {
  if (id === selfId) return { error: "Você não pode alterar a sua própria conta por aqui" };
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data.user) return { error: "Usuário não encontrado" };
  if (parseRole(data.user.app_metadata?.role) === "super_admin") {
    return { error: "O super administrador não pode ser alterado" };
  }
  return { admin, user: data.user };
}

export async function createUserAction(input: {
  fullName: string;
  email: string;
  password: string;
  role: string;
}): Promise<UserAdminState> {
  if (!(await getSuperAdminId())) return NOT_ALLOWED;
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { fullName, email, password, role } = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role },
  });
  if (error || !data.user) {
    const msg = error?.message ?? "";
    return {
      error: /already|registered|exists/i.test(msg)
        ? "Já existe um usuário com esse e-mail"
        : `Erro ao criar o usuário${msg ? `: ${msg}` : ""}`,
    };
  }

  // O trigger já cria a linha; o upsert garante nome e role mesmo se ele falhar.
  await admin
    .from("users")
    .upsert({ id: data.user.id, email, full_name: fullName, avatar_url: null, role }, { onConflict: "id" });

  revalidatePath("/usuarios");
  return { success: true };
}

export async function updateUserAction(
  id: string,
  input: { fullName: string; role: string; password?: string }
): Promise<UserAdminState> {
  const selfId = await getSuperAdminId();
  if (!selfId) return NOT_ALLOWED;
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const target = await loadTarget(id, selfId);
  if ("error" in target) return { error: target.error };
  const { admin, user } = target;
  const { fullName, role, password } = parsed.data;

  const { error } = await admin.auth.admin.updateUserById(id, {
    app_metadata: { ...user.app_metadata, role },
    user_metadata: { ...user.user_metadata, full_name: fullName },
    ...(password ? { password } : {}),
  });
  if (error) return { error: `Erro ao salvar: ${error.message}` };

  await admin.from("users").update({ full_name: fullName, role }).eq("id", id);

  revalidatePath("/usuarios");
  return { success: true };
}

export async function setUserDisabledAction(id: string, disabled: boolean): Promise<UserAdminState> {
  const selfId = await getSuperAdminId();
  if (!selfId) return NOT_ALLOWED;
  const target = await loadTarget(id, selfId);
  if ("error" in target) return { error: target.error };

  const { error } = await target.admin.auth.admin.updateUserById(id, {
    ban_duration: disabled ? "876000h" : "none",
  });
  if (error) return { error: `Erro ao ${disabled ? "desativar" : "reativar"}: ${error.message}` };

  revalidatePath("/usuarios");
  return { success: true };
}

export async function deleteUserAction(id: string): Promise<UserAdminState> {
  const selfId = await getSuperAdminId();
  if (!selfId) return NOT_ALLOWED;
  const target = await loadTarget(id, selfId);
  if ("error" in target) return { error: target.error };

  const { error } = await target.admin.auth.admin.deleteUser(id);
  if (error) return { error: `Erro ao excluir: ${error.message}` };

  revalidatePath("/usuarios");
  return { success: true };
}
