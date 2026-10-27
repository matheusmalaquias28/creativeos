import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth/permissions";
import { getCurrentUserProfile } from "@/services/users";
import type { User } from "@/types/database";
import { InstagramAccountError } from "./account";
import { InstagramPostError } from "./posts";

/** Publicar no Instagram é ação de admin (o middleware já barra as outras roles). */
export async function requireInstagramAdmin(): Promise<{ user: User } | { response: NextResponse }> {
  const user = await getCurrentUserProfile();
  if (!user) return { response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  if (!isAdminRole(user.role)) {
    return { response: NextResponse.json({ error: "Só administradores publicam no Instagram" }, { status: 403 }) };
  }
  return { user };
}

export function instagramErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof InstagramPostError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof InstagramAccountError) return NextResponse.json({ error: error.message }, { status: 503 });
  console.error(`[instagram] ${context}`, error);
  return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado" }, { status: 500 });
}
