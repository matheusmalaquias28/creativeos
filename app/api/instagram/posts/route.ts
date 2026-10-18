/**
 * GET  /api/instagram/posts?carouselId=…   histórico do carrossel
 * POST /api/instagram/posts                 cria o post (cards já no Storage)
 *   { postId, carouselId, items: [{ path, page_id }], caption, scheduledAt: ISO | null, igUserId }
 *   scheduledAt null = publica agora, nesta mesma requisição.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAccountForClient } from "@/lib/instagram/account";
import { feedFormatError } from "@/lib/instagram/jpeg";
import { createPost, publishPostNow, toInstagramPost, verifyUploadedItems } from "@/lib/instagram/posts";
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

  const carouselId = new URL(request.url).searchParams.get("carouselId");
  if (!carouselId) return NextResponse.json({ error: "carouselId obrigatório" }, { status: 400 });
  const { data, error } = await supabase
    .from("instagram_posts")
    .select("*")
    .eq("studio_carousel_id", carouselId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: (data ?? []).map(toInstagramPost) });
}

const bodySchema = z.object({
  postId: z.string().uuid(),
  carouselId: z.string().uuid(),
  items: z.array(z.object({ path: z.string().min(1), page_id: z.string().nullish() })),
  caption: z.string().max(CAPTION_MAX_CHARS, `Legenda passa de ${CAPTION_MAX_CHARS} caracteres`),
  scheduledAt: z.string().datetime({ offset: true }).nullable(),
  /** Conta que o usuário viu na confirmação — se mudou, não publica. */
  igUserId: z.string().min(1),
});

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
    const { data: carousel } = await admin
      .from("studio_carousels")
      .select("id, format, client_id")
      .eq("id", body.carouselId)
      .maybeSingle();
    if (!carousel) return NextResponse.json({ error: "Carrossel não encontrado" }, { status: 404 });
    const formatError = feedFormatError(carousel.format);
    if (formatError) return NextResponse.json({ error: formatError }, { status: 422 });

    const account = await resolveAccountForClient(carousel.client_id);
    if (account.igUserId !== body.igUserId) {
      return NextResponse.json(
        { error: `A conta de destino mudou para @${account.username ?? account.igUserId}. Abra o diálogo de novo e confira.` },
        { status: 409 }
      );
    }

    const items = await verifyUploadedItems(admin, { carouselId: body.carouselId, postId: body.postId, items: body.items });
    let post = await createPost(admin, {
      id: body.postId,
      carouselId: body.carouselId,
      clientId: carousel.client_id,
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
