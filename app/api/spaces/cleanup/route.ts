/**
 * POST /api/spaces/cleanup
 *
 * TTL do Space: apaga as imagens geradas (PNGs no Storage + linhas art_version)
 * cujo `expires_at` já passou — mantendo o grafo intacto (regenerar reconstrói).
 * Disparado diariamente pelo pg_cron (ver migration 20261002000000_spaces_ttl),
 * protegido por `SPACES_CLEANUP_SECRET`.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

const BUCKET = "art-generations";
const CHUNK = 100;

export async function POST(req: Request) {
  // Fail-closed: sem secret configurado, a limpeza fica desligada (nada apaga).
  const secret = process.env.SPACES_CLEANUP_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Limpeza desativada" }, { status: 503 });
  }
  const provided = req.headers.get("x-cleanup-secret")?.trim();
  if (provided !== secret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: expired, error } = await supabase
    .from("art_version")
    .select("id, storage_path")
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = expired ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, removed: 0 });
  }

  // Remove o PNG final e o irmão `_raw` (insumo dos ajustes, não versionado).
  const paths = rows.flatMap((r) => {
    const p = r.storage_path as string;
    const raw = p.replace(/\.png$/i, "_raw.png");
    return raw !== p ? [p, raw] : [p];
  });

  for (let i = 0; i < paths.length; i += CHUNK) {
    const { error: rmError } = await supabase.storage
      .from(BUCKET)
      .remove(paths.slice(i, i + CHUNK));
    if (rmError) {
      console.error("[spaces/cleanup] storage.remove:", rmError.message);
    }
  }

  const ids = rows.map((r) => r.id as string);
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error: delError } = await supabase
      .from("art_version")
      .delete()
      .in("id", ids.slice(i, i + CHUNK));
    if (delError) {
      return NextResponse.json({ error: delError.message, removed: i }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, removed: ids.length });
}
