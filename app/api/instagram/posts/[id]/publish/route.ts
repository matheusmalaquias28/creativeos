/**
 * POST /api/instagram/posts/[id]/publish
 * Publica agora um post agendado ou tenta de novo um que falhou.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishPostNow } from "@/lib/instagram/posts";
import { instagramErrorResponse, requireInstagramAdmin } from "@/lib/instagram/http";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const auth = await requireInstagramAdmin();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  try {
    const post = await publishPostNow(createAdminClient(), id);
    return NextResponse.json({ post });
  } catch (error) {
    return instagramErrorResponse(error, `publicar ${id}`);
  }
}
