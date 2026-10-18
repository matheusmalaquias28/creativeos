/** POST /api/instagram/posts/[id]/cancel — cancela um post agendado. */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelPost } from "@/lib/instagram/posts";
import { instagramErrorResponse, requireInstagramAdmin } from "@/lib/instagram/http";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const auth = await requireInstagramAdmin();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  try {
    const post = await cancelPost(createAdminClient(), id);
    return NextResponse.json({ post });
  } catch (error) {
    return instagramErrorResponse(error, `cancelar ${id}`);
  }
}
