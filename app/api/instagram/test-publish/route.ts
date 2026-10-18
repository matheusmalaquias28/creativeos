/**
 * POST /api/instagram/test-publish  { carouselId, dryRun? }
 *
 * Spike: publica um carrossel pronto do Studio na conta de TESTE do Instagram
 * configurada no env (INSTAGRAM_TEST_IG_USER_ID + INSTAGRAM_TEST_ACCESS_TOKEN).
 * Só admin. `dryRun: true` converte e sobe os JPEGs e consulta a cota, mas
 * não publica nada. Ver lib/instagram/README.md.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRole } from "@/lib/auth/permissions";
import { getCurrentUserProfile } from "@/services/users";
import { InstagramPublishError } from "@/lib/instagram/errors";
import { getPublishingQuota, publishCarousel, validateCarouselInput } from "@/lib/instagram/publish";
import { prepareStudioCarouselImages, StudioImagesError } from "@/lib/instagram/studio-images";

// Conversão + polling dos containers (até 2min por etapa).
export const maxDuration = 300;

const bodySchema = z.object({
  carouselId: z.string().uuid("carouselId inválido"),
  dryRun: z.boolean().optional(),
});

export async function POST(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isAdminRole(profile.role)) {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const igUserId = process.env.INSTAGRAM_TEST_IG_USER_ID?.trim();
  const accessToken = process.env.INSTAGRAM_TEST_ACCESS_TOKEN?.trim();
  if (!igUserId || !accessToken) {
    return NextResponse.json(
      { error: "Configure INSTAGRAM_TEST_IG_USER_ID e INSTAGRAM_TEST_ACCESS_TOKEN no ambiente (ver lib/instagram/README.md)." },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corpo inválido" }, { status: 400 });
  }
  const { carouselId, dryRun } = parsed.data;

  try {
    // Cota primeiro: é barata e já pega token inválido antes de converter imagens.
    const quota = await getPublishingQuota({ igUserId, accessToken });
    if (quota.total !== null && quota.used >= quota.total) {
      return NextResponse.json(
        { error: `Limite de publicações via API atingido nas últimas 24h (${quota.used}/${quota.total}).`, quota },
        { status: 429 }
      );
    }

    const { carousel, imageUrls, warnings } = await prepareStudioCarouselImages(carouselId);
    const caption = carousel.caption ?? "";
    validateCarouselInput({ imageUrls, caption });

    if (dryRun) {
      return NextResponse.json({ dryRun: true, imageUrls, caption, quota, warnings });
    }

    const result = await publishCarousel(
      { igUserId, accessToken, imageUrls, caption },
      { onProgress: (message) => console.log(`[instagram/test-publish] ${carouselId}: ${message}`) }
    );
    console.log(`[instagram/test-publish] ${carouselId} publicado: ${result.mediaId} ${result.permalink ?? ""}`);
    return NextResponse.json({
      mediaId: result.mediaId,
      permalink: result.permalink,
      imageUrls,
      warnings,
    });
  } catch (error) {
    if (error instanceof StudioImagesError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof InstagramPublishError) {
      console.error(
        `[instagram/test-publish] ${carouselId} falhou em ${error.step}`,
        { code: error.code, subcode: error.subcode, fbtraceId: error.fbtraceId },
        error.message
      );
      return NextResponse.json(
        { error: error.message, step: error.step, code: error.code, subcode: error.subcode, fbtraceId: error.fbtraceId },
        { status: error.step === "validate" ? 422 : 502 }
      );
    }
    console.error("[instagram/test-publish] erro inesperado", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado" }, { status: 500 });
  }
}
