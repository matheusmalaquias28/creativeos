/**
 * POST /api/instagram/posts/upload  { carouselId, count } | { tweetCarouselId, count }
 *
 * Reserva o id do post e emite URLs assinadas para o navegador subir os cards
 * (JPEG) direto no bucket `instagram-posts`, sem passar os bytes pela rota.
 * O post só é criado depois, em POST /api/instagram/posts.
 * `carouselId` = carrossel do Studio; `tweetCarouselId` = carrossel estilo tweet.
 */

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { feedFormatError } from "@/lib/instagram/jpeg";
import { cardPath, INSTAGRAM_POSTS_BUCKET, tweetCardPath } from "@/lib/instagram/posts";
import { CAROUSEL_MAX_ITEMS, CAROUSEL_MIN_ITEMS } from "@/lib/instagram/publish";
import { instagramErrorResponse, requireInstagramAdmin } from "@/lib/instagram/http";

const bodySchema = z
  .object({
    carouselId: z.string().uuid("carouselId inválido").optional(),
    tweetCarouselId: z.string().uuid("tweetCarouselId inválido").optional(),
    count: z.number().int().min(CAROUSEL_MIN_ITEMS).max(CAROUSEL_MAX_ITEMS),
  })
  .refine((b) => !!b.carouselId !== !!b.tweetCarouselId, "Informe carouselId ou tweetCarouselId");

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
  const { carouselId, tweetCarouselId, count } = parsed.data;

  try {
    const admin = createAdminClient();
    let pathFor: (postId: string, index: number) => string;
    if (tweetCarouselId) {
      // Carrossel tweet é sempre 1080×1350 (4:5), formato do feed.
      const { data: tweet } = await admin.from("tweet_carousels").select("id").eq("id", tweetCarouselId).maybeSingle();
      if (!tweet) return NextResponse.json({ error: "Carrossel não encontrado" }, { status: 404 });
      pathFor = (postId, i) => tweetCardPath(tweetCarouselId, postId, i);
    } else {
      const { data: carousel } = await admin.from("studio_carousels").select("id, format").eq("id", carouselId!).maybeSingle();
      if (!carousel) return NextResponse.json({ error: "Carrossel não encontrado" }, { status: 404 });
      const formatError = feedFormatError(carousel.format);
      if (formatError) return NextResponse.json({ error: formatError }, { status: 422 });
      pathFor = (postId, i) => cardPath(carouselId!, postId, i);
    }

    const postId = randomUUID();
    const targets = [];
    for (let i = 0; i < count; i++) {
      const path = pathFor(postId, i);
      const { data, error } = await admin.storage.from(INSTAGRAM_POSTS_BUCKET).createSignedUploadUrl(path, { upsert: true });
      if (error || !data) throw new Error(error?.message ?? "Não foi possível preparar o upload");
      targets.push({ path, token: data.token });
    }
    return NextResponse.json({ postId, targets });
  } catch (error) {
    return instagramErrorResponse(error, "upload");
  }
}
