/**
 * DELETE /api/art-gen/[jobId]
 *
 * Apaga uma arte e tudo que pende dela: o prompt, as referências escolhidas, as
 * versões e os PNGs no Storage. É o "não quero essa" da curadoria — sem isso o
 * operador só conseguia esconder o card regerando por cima.
 *
 * Roda pelo admin client: as versões e referências saem por cascade, mas o
 * Storage não tem cascade nenhum e ficaria com o lixo.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "art-generations";

async function removeStorageFolder(
  supabase: ReturnType<typeof createAdminClient>,
  jobId: string
): Promise<void> {
  const { data } = await supabase.storage.from(BUCKET).list(jobId);
  const paths = (data ?? []).map((file) => `${jobId}/${file.name}`);
  if (paths.length === 0) return;
  await supabase.storage.from(BUCKET).remove(paths);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: job } = await supabase
    .from("art_generation_job")
    .select("id, status")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) return NextResponse.json({ ok: true, alreadyGone: true });

  // Storage primeiro: se a linha sumisse antes, o jobId se perderia e os PNGs
  // ficariam órfãos sem ninguém para apagá-los.
  await removeStorageFolder(supabase, jobId).catch((err) =>
    console.warn("[art-gen/delete] storage:", (err as Error)?.message ?? err)
  );

  const { error } = await supabase.from("art_generation_job").delete().eq("id", jobId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
