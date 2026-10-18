/**
 * POST /api/instagram/demand-posts
 *   { demandId, fileIds: [ids de demand_export_files, na ordem], caption, scheduledAt: ISO | null, igUserId }
 *
 * Botão "Publicar no Instagram" da página da demanda: usa as artes do feed
 * que já estão em "Entregar demanda" (1 arte = post simples, 2+ = carrossel).
 * scheduledAt null = publica agora, nesta mesma requisição.
 */

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAccountForClient } from "@/lib/instagram/account";
import { createPost, prepareDemandItems, publishPostNow } from "@/lib/instagram/posts";
import { CAPTION_MAX_CHARS, CAROUSEL_MAX_ITEMS } from "@/lib/instagram/publish";
import { validateScheduledAt } from "@/lib/instagram/schedule";
import { instagramErrorResponse, requireInstagramAdmin } from "@/lib/instagram/http";

export const maxDuration = 300;

const bodySchema = z.object({
  demandId: z.string().uuid(),
  fileIds: z.array(z.string().uuid()).min(1, "Escolha pelo menos uma arte").max(CAROUSEL_MAX_ITEMS),
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
    const { data: demand } = await admin.from("creative_demands").select("id, client_id").eq("id", body.demandId).maybeSingle();
    if (!demand) return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });

    const account = await resolveAccountForClient(demand.client_id);
    if (account.igUserId !== body.igUserId) {
      return NextResponse.json(
        { error: `A conta de destino mudou para @${account.username ?? account.igUserId}. Abra o diálogo de novo e confira.` },
        { status: 409 }
      );
    }

    const postId = randomUUID();
    const items = await prepareDemandItems(admin, { demandId: body.demandId, postId, fileIds: body.fileIds });
    let post = await createPost(admin, {
      id: postId,
      carouselId: null,
      demandId: body.demandId,
      clientId: demand.client_id,
      account,
      items,
      caption: body.caption,
      scheduledAt: body.scheduledAt,
      createdBy: auth.user.id,
    });
    if (!body.scheduledAt) post = await publishPostNow(admin, post.id);
    return NextResponse.json({ post });
  } catch (error) {
    return instagramErrorResponse(error, "post da demanda");
  }
}
