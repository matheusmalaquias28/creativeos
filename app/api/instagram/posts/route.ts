/**
 * GET  /api/instagram/posts?carouselId=… | ?tweetCarouselId=… | ?demandId=…   histórico
 * POST /api/instagram/posts                 cria o post (cards já no Storage)
 *   { postId, carouselId | tweetCarouselId, items: [{ path, page_id }], caption, scheduledAt: ISO | null, igUserId }
 *   scheduledAt null = publica agora, nesta mesma requisição.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAccount } from "@/lib/instagram/account";
import { feedFormatError } from "@/lib/instagram/jpeg";
import { createPost, publishPostNow, toInstagramPost, tweetPostFolder, verifyUploadedItems } from "@/lib/instagram/posts";
import { CAPTION_MAX_CHARS } from "@/lib/instagram/publish";
import { validateScheduledAt } from "@/lib/instagram/schedule";
import { instagramErrorResponse, requireInstagramAdmin } from "@/lib/instagram/http";

// "Publicar agora" espera o Instagram processar os containers.
export const maxDuration = 300;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const search = new URL(request.url).searchParams;
  const scope = (
    [
      ["carouselId", "studio_carousel_id"],
      ["tweetCarouselId", "tweet_carousel_id"],
      ["demandId", "demand_id"],
    ] as const
  )
    .map(([param, column]) => ({ column, id: search.get(param) }))
    .find((s) => s.id);
  if (!scope?.id) {
    return NextResponse.json({ error: "carouselId, tweetCarouselId ou demandId obrigatório" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("instagram_posts")
    .select("*")
    .eq(scope.column, scope.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: (data ?? []).map(toInstagramPost) });
}

const bodySchema = z
  .object({
    postId: z.string().uuid(),
    carouselId: z.string().uuid().optional(),
    tweetCarouselId: z.string().uuid().optional(),
    items: z.array(z.object({ path: z.string().min(1), page_id: z.string().nullish() })),
    caption: z.string().max(CAPTION_MAX_CHARS, `Legenda passa de ${CAPTION_MAX_CHARS} caracteres`),
    scheduledAt: z.string().datetime({ offset: true }).nullable(),
    /** Conta escolhida no diálogo (e mostrada na confirmação). */
    igUserId: z.string().min(1),
  })
  .refine((b) => !!b.carouselId !== !!b.tweetCarouselId, "Informe carouselId ou tweetCarouselId");

export async function POST(request: Request) {
  const auth = await requireInstagramAdmin();
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const body = parsed.data;

  if (body.scheduledAt) {
    const scheduleError = validateScheduledAt(body.scheduledAt);
    if (scheduleError) return NextResponse.json({ error: scheduleError }, { status: 422 });
  }

  try {
    const admin = createAdminClient();
    let source: { carouselId: string | null; tweetCarouselId: string | null; demandId: string | null; clientId: string | null; folder?: string };

    if (body.tweetCarouselId) {
      const { data: tweet } = await admin.from("tweet_carousels").select("id").eq("id", body.tweetCarouselId).maybeSingle();
      if (!tweet) return NextResponse.json({ error: "Carrossel não encontrado" }, { status: 404 });
      source = {
        carouselId: null,
        tweetCarouselId: body.tweetCarouselId,
        demandId: null,
        clientId: null,
        folder: tweetPostFolder(body.tweetCarouselId, body.postId),
      };
    } else {
      const { data: carousel } = await admin
        .from("studio_carousels")
        .select("id, format, client_id, demand_id")
        .eq("id", body.carouselId!)
        .maybeSingle();
      if (!carousel) return NextResponse.json({ error: "Carrossel não encontrado" }, { status: 404 });
      const formatError = feedFormatError(carousel.format);
      if (formatError) return NextResponse.json({ error: formatError }, { status: 422 });
      source = { carouselId: carousel.id, tweetCarouselId: null, demandId: carousel.demand_id, clientId: carousel.client_id };
    }

    const account = await resolveAccount(body.igUserId);

    const items = await verifyUploadedItems(admin, {
      carouselId: source.carouselId ?? source.tweetCarouselId!,
      postId: body.postId,
      items: body.items,
      folder: source.folder,
    });
    let post = await createPost(admin, {
      id: body.postId,
      carouselId: source.carouselId,
      tweetCarouselId: source.tweetCarouselId,
      demandId: source.demandId,
      clientId: source.clientId,
      account,
      items,
      caption: body.caption,
      scheduledAt: body.scheduledAt,
      createdBy: auth.user.id,
    });
    if (!body.scheduledAt) post = await publishPostNow(admin, post.id);
    return NextResponse.json({ post });
  } catch (error) {
    return instagramErrorResponse(error, "criar post");
  }
}
