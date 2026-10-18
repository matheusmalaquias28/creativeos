/**
 * POST /api/instagram/posts/upload  { carouselId, count }
 *
 * Reserva o id do post e emite URLs assinadas para o navegador subir os cards
 * (JPEG) direto no bucket `instagram-posts`, sem passar os bytes pela rota.
 * O post só é criado depois, em POST /api/instagram/posts.
 */

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { feedFormatError } from "@/lib/instagram/jpeg";
import { cardPath, INSTAGRAM_POSTS_BUCKET } from "@/lib/instagram/posts";
import { CAROUSEL_MAX_ITEMS, CAROUSEL_MIN_ITEMS } from "@/lib/instagram/publish";
import { instagramErrorResponse, requireInstagramAdmin } from "@/lib/instagram/http";

const bodySchema = z.object({
  carouselId: z.string().uuid("carouselId inválido"),
  count: z.number().int().min(CAROUSEL_MIN_ITEMS).max(CAROUSEL_MAX_ITEMS),
});

export async function POST(request: Request) {
  const auth = await requireInstagramAdmin();
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Escolha de ${CAROUSEL_MIN_ITEMS} a ${CAROUSEL_MAX_ITEMS} cards` },
      { status: 400 }
    );
  }
  const { carouselId, count } = parsed.data;

  try {
    const admin = createAdminClient();
    const { data: carousel } = await admin.from("studio_carousels").select("id, format").eq("id", carouselId).maybeSingle();
    if (!carousel) return NextResponse.json({ error: "Carrossel não encontrado" }, { status: 404 });
    const formatError = feedFormatError(carousel.format);
    if (formatError) return NextResponse.json({ error: formatError }, { status: 422 });

    const postId = randomUUID();
    const targets = [];
    for (let i = 0; i < count; i++) {
      const path = cardPath(carouselId, postId, i);
      const { data, error } = await admin.storage.from(INSTAGRAM_POSTS_BUCKET).createSignedUploadUrl(path, { upsert: true });
      if (error || !data) throw new Error(error?.message ?? "Não foi possível preparar o upload");
      targets.push({ path, token: data.token });
    }
    return NextResponse.json({ postId, targets });
  } catch (error) {
    return instagramErrorResponse(error, "upload");
  }
}
