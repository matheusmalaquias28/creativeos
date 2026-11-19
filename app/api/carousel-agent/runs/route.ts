/**
 * Agente de Carrossel — contrato com o agente (ver lib/carousel-agent/README.md).
 *
 * POST: pede um carrossel. Responde na hora (202) e a geração segue em
 * segundo plano; o carrossel fica "Aguardando aprovação" na aba Agente.
 * GET: últimos carrosséis pedidos.
 *
 * Auth: `Authorization: Bearer $CAROUSEL_AGENT_SECRET` (agente) ou admin logado.
 */

import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CarouselProfile } from "@/types/carousel-profile";
import { agentErrorResponse, requireAgentOrAdmin } from "@/lib/carousel-agent/auth";
import { createRunSchema, runFieldsFromBody, scheduledAtProblem, zodMessage } from "@/lib/carousel-agent/request";
import {
  AgentRunError,
  appUrl,
  insertRun,
  listRuns,
  normalizeUsername,
  publicRun,
  resolveProfileAccount,
} from "@/lib/carousel-agent/runs";
import { runGeneration } from "@/lib/carousel-agent/pipeline";
import { checkCanStart, estimatedImages } from "@/lib/carousel-agent/limits";
import { loadStyleTemplatePages } from "@/lib/carousel-styles/templates";

export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await requireAgentOrAdmin(request);
  if ("response" in auth) return auth.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Body precisa ser JSON" }, { status: 400 });
  }
  const parsed = createRunSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
  const body = parsed.data;

  try {
    if (body.scheduledAt) {
      const problem = scheduledAtProblem(body.scheduledAt);
      if (problem) throw new AgentRunError(problem);
    }

    const admin = createAdminClient();
    let profile: CarouselProfile | null = null;
    if (body.profileId) {
      const { data } = await admin.from("carousel_profiles").select("*").eq("id", body.profileId).maybeSingle();
      profile = data as CarouselProfile | null;
    } else {
      const wanted = normalizeUsername(body.instagram);
      const { data } = await admin.from("carousel_profiles").select("*").not("instagram_handle", "is", null);
      const matches = ((data ?? []) as CarouselProfile[]).filter((p) => normalizeUsername(p.instagram_handle) === wanted);
      if (matches.length > 1) {
        throw new AgentRunError(`Há ${matches.length} perfis com o @${wanted}. Mande o profileId.`, 409);
      }
      profile = matches[0] ?? null;
    }
    if (!profile) throw new AgentRunError("Perfil de design não encontrado.", 404);

    const account = await resolveProfileAccount(profile.instagram_handle);

    // Studio: o estilo precisa existir e ter páginas-modelo.
    if (body.format === "studio" && body.styleId) {
      const pages = await loadStyleTemplatePages(body.styleId);
      if (!pages.length) {
        throw new AgentRunError("Estilo sem páginas-modelo (ou inexistente). Veja GET /api/carousel-agent/styles.", 422);
      }
    }

    // Freios de gasto: pedidos gerando ao mesmo tempo e teto diário de imagens.
    const fields = runFieldsFromBody(body);
    const limit = await checkCanStart(admin, { images: estimatedImages(body.format, fields.cardCount) });
    if (limit) return NextResponse.json({ error: limit.message }, { status: limit.status });

    const run = await insertRun(admin, {
      profile,
      account,
      mode: fields.mode,
      format: body.format,
      options: fields.options,
      input: fields.input,
      cardCount: fields.cardCount,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt).toISOString() : null,
      externalRef: body.externalRef ?? null,
      callbackUrl: body.callbackUrl ?? null,
    });

    after(() => runGeneration(run.id));
    return NextResponse.json(publicRun(run, appUrl()), { status: 202 });
  } catch (error) {
    return agentErrorResponse(error, "criar carrossel");
  }
}

export async function GET(request: Request) {
  const auth = await requireAgentOrAdmin(request);
  if ("response" in auth) return auth.response;
  const limit = Math.min(100, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 20));
  const runs = await listRuns(createAdminClient(), limit);
  return NextResponse.json({ runs: runs.map((r) => publicRun(r, appUrl())) });
}
