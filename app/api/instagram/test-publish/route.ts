/**
 * POST /api/instagram/test-publish  { carouselId, dryRun? }
 *
 * Spike: publica um carrossel pronto do Studio na conta de TESTE do Instagram
 * configurada no env: INSTAGRAM_ACCESS_TOKEN (ou INSTAGRAM_TEST_ACCESS_TOKEN) e,
 * opcionalmente, INSTAGRAM_TEST_IG_USER_ID — sem ele, com token do Instagram
 * Login (IGAA…), o id sai de GET /me. Só admin. `dryRun: true` converte e sobe
 * os JPEGs e mostra conta + cota, mas não publica nada. Ver lib/instagram/README.md.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRole } from "@/lib/auth/permissions";
import { getCurrentUserProfile } from "@/services/users";
import { InstagramPublishError } from "@/lib/instagram/errors";
import {
  getInstagramAccount,
  getPublishingQuota,
  graphHostForToken,
  publishCarousel,
  validateCarouselInput,
  type InstagramAccount,
} from "@/lib/instagram/publish";
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

  const accessToken = (process.env.INSTAGRAM_ACCESS_TOKEN || process.env.INSTAGRAM_TEST_ACCESS_TOKEN)?.trim();
  const envIgUserId = process.env.INSTAGRAM_TEST_IG_USER_ID?.trim() || null;
  const isInstagramLogin = accessToken ? graphHostForToken(accessToken) === "graph.instagram.com" : false;
  if (!accessToken) {
    return NextResponse.json(
      { error: "Configure INSTAGRAM_ACCESS_TOKEN no ambiente (ver lib/instagram/README.md)." },
      { status: 503 }
    );
  }
  if (!envIgUserId && !isInstagramLogin) {
    return NextResponse.json(
      { error: "Com token do Facebook Login (EAA…), defina também INSTAGRAM_TEST_IG_USER_ID (ver lib/instagram/README.md)." },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corpo inválido" }, { status: 400 });
  }
  const { carouselId, dryRun } = parsed.data;

  try {
    // Conta e cota primeiro: são baratas e já pegam token inválido antes de
    // converter imagens. No Instagram Login o /me diz de quem é o token.
    let account: InstagramAccount = { igUserId: envIgUserId ?? "", username: null };
    if (isInstagramLogin) {
      const me = await getInstagramAccount({ accessToken });
      if (envIgUserId && envIgUserId !== me.igUserId) {
        return NextResponse.json(
          {
            error: `INSTAGRAM_TEST_IG_USER_ID (${envIgUserId}) não é a conta do token (@${me.username ?? "?"}, ${me.igUserId}). Corrija ou remova a variável.`,
          },
          { status: 422 }
        );
      }
      account = me;
    }
    const igUserId = account.igUserId;

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
      return NextResponse.json({ dryRun: true, account, imageUrls, caption, quota, warnings });
    }

    const result = await publishCarousel(
      { igUserId, accessToken, imageUrls, caption },
      { onProgress: (message) => console.log(`[instagram/test-publish] ${carouselId}: ${message}`) }
    );
    console.log(`[instagram/test-publish] ${carouselId} publicado: ${result.mediaId} ${result.permalink ?? ""}`);
    return NextResponse.json({
      account,
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
