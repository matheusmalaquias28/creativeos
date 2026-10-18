/**
 * Cron: publica os posts do Instagram agendados que já venceram.
 *
 * Dois jeitos de chamar, ambos com segredo (fail-closed: sem segredo
 * configurado, nada publica):
 *   - Vercel Cron: GET com `Authorization: Bearer $CRON_SECRET`.
 *   - pg_cron/pg_net ou Make: POST com `x-cron-secret: $INSTAGRAM_CRON_SECRET`.
 * Chamadas repetidas ou simultâneas não duplicam posts: cada post é
 * reivindicado com um UPDATE condicional (ver lib/instagram/posts.ts).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishDuePosts } from "@/lib/instagram/posts";

export const maxDuration = 300;

function authorized(request: Request): boolean | null {
  const secrets = [process.env.INSTAGRAM_CRON_SECRET, process.env.CRON_SECRET]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  if (secrets.length === 0) return null;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const header = request.headers.get("x-cron-secret")?.trim();
  return secrets.some((s) => s === bearer || s === header);
}

async function run(request: Request) {
  const ok = authorized(request);
  if (ok === null) return NextResponse.json({ error: "Cron do Instagram desativado (sem segredo)" }, { status: 503 });
  if (!ok) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const summary = await publishDuePosts(createAdminClient());
    if (summary.due || summary.stale) console.log("[instagram/cron]", JSON.stringify(summary));
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[instagram/cron] falhou", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
