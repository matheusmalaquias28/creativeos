/**
 * GET /api/instagram/account
 * Contas conectadas (@username) para o diálogo escolher onde vai postar.
 */

import { NextResponse } from "next/server";
import { listAccounts } from "@/lib/instagram/account";
import { instagramErrorResponse, requireInstagramAdmin } from "@/lib/instagram/http";

export async function GET() {
  const auth = await requireInstagramAdmin();
  if ("response" in auth) return auth.response;

  try {
    const accounts = await listAccounts();
    return NextResponse.json({ accounts: accounts.map(({ igUserId, username }) => ({ igUserId, username })) });
  } catch (error) {
    return instagramErrorResponse(error, "conta");
  }
}
