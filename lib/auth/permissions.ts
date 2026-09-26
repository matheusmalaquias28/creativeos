/**
 * Roles e permissões — fonte única, isomórfica (middleware, server e client).
 *
 * A role do usuário vive em `auth.users.app_metadata.role` (só o service role
 * escreve lá) e é espelhada em `public.users.role`.
 */

export type AppRole = "super_admin" | "admin" | "carousel_creator" | "member";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super administrador",
  admin: "Administrador",
  carousel_creator: "Carrossel Creator",
  member: "Sem acesso",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: "Acesso total e gestão de usuários.",
  admin: "Acesso a todas as áreas da plataforma.",
  carousel_creator: "Acesso somente à aba Carrosséis.",
  member: "Conta sem permissões atribuídas.",
};

/** Roles que o super admin pode atribuir pela tela de Usuários. */
export const ASSIGNABLE_ROLES = ["admin", "carousel_creator"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function parseRole(value: unknown): AppRole {
  return value === "super_admin" || value === "admin" || value === "carousel_creator"
    ? value
    : "member";
}

export function isAdminRole(role: AppRole): boolean {
  return role === "super_admin" || role === "admin";
}

/** Rotas que qualquer um acessa (auth, webhooks externos, assets). */
const PUBLIC_PREFIXES = ["/login", "/auth", "/sem-acesso", "/api/webhooks", "/_next", "/favicon.ico"];

/** Só o super admin. */
const SUPER_ADMIN_PREFIXES = ["/usuarios"];

/** Prefixos liberados por role restrita (páginas + APIs que essas páginas usam). */
const RESTRICTED_ALLOW: Partial<Record<AppRole, string[]>> = {
  carousel_creator: [
    "/carousel",
    "/api/carousel",
    // fundo/imagens geradas dentro do editor de carrossel
    "/api/gerador/generate",
    "/api/gerador/task",
    "/api/gerador/upload-ref",
    "/api/images/persist",
  ],
  member: [],
};

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => matches(pathname, p));
}

export function canAccessPath(role: AppRole, pathname: string): boolean {
  if (isPublicPath(pathname)) return true;
  if (SUPER_ADMIN_PREFIXES.some((p) => matches(pathname, p))) return role === "super_admin";
  if (isAdminRole(role)) return true;
  if (pathname === "/") return true; // a landing redireciona para a home da role
  return (RESTRICTED_ALLOW[role] ?? []).some((p) => matches(pathname, p));
}

/** Para onde mandar o usuário depois do login / quando cai numa rota proibida. */
export function homePathFor(role: AppRole): string {
  if (isAdminRole(role)) return "/dashboard";
  if (role === "carousel_creator") return "/carousel";
  return "/sem-acesso";
}
