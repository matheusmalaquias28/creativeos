/**
 * GET /api/instagram/account?carouselId=…
 * Conta de destino (@username) para o diálogo mostrar onde vai postar.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAccountForClient } from "@/lib/instagram/account";
import { instagramErrorResponse, requireInstagramAdmin } from "@/lib/instagram/http";

export async function GET(request: Request) {
  const auth = await requireInstagramAdmin();
  if ("response" in auth) return auth.response;

  const carouselId = new URL(request.url).searchParams.get("carouselId");
  try {
    let clientId: string | null = null;
    if (carouselId) {
      const { data } = await createAdminClient().from("studio_carousels").select("client_id").eq("id", carouselId).maybeSingle();
      clientId = data?.client_id ?? null;
    }
    const account = await resolveAccountForClient(clientId);
    return NextResponse.json({ igUserId: account.igUserId, username: account.username });
  } catch (error) {
    return instagramErrorResponse(error, "conta");
  }
}
