import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWorker } from "@/lib/ai/imagegen/worker";
import { extractFlowJobParams, flowJobParamsToRow } from "@/lib/flow/extract-flow-jobs";
import { enrichFlowGraphWithProfile } from "@/lib/flow/enrich-graph";
import { loadFlowCreativeProfile } from "@/lib/flow/load-creative-profile";
import { getClientFlowGraph, syncAndPersistDemandReferences } from "@/services/flow";
import type { FlowGraph } from "@/lib/flow/types";

// Cobre o worker de geração (rodado via after() abaixo) — cada job tem seu próprio
// timeout de 2min (IMAGE_JOB_TIMEOUT_MS em lib/ai/imagegen/worker.ts), mas isso só
// funciona se a função em si não for encerrada antes disso.
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id: demandId } = await params;
  const supabase = createAdminClient();

  const { data: demand, error: demandError } = await supabase
    .from("creative_demands")
    .select("id, client_id, briefing, flow_graph")
    .eq("id", demandId)
    .single();

  if (demandError || !demand) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
  }

  const savedGraph = demand.client_id
    ? await getClientFlowGraph(demand.client_id)
    : ((demand.flow_graph as FlowGraph | null) ?? null);

  if (!savedGraph || !savedGraph.nodes?.length) {
    return NextResponse.json(
      { error: "Nenhum fluxo salvo — salve o fluxo antes de executar" },
      { status: 400 }
    );
  }

  // Sincroniza referências cadastradas na página da demanda antes de gerar —
  // sem isso, gerar via API logo após cadastrar uma referência rodaria contra
  // o grafo desatualizado (ela só apareceria no Space na próxima vez que a
  // página fosse aberta).
  const graph = await syncAndPersistDemandReferences(demand, savedGraph);

  const profile = await loadFlowCreativeProfile(demand.client_id ?? null);

  const enrichedGraph = enrichFlowGraphWithProfile(graph, profile);
  const briefing = (demand.briefing as { titulo?: string; tipo?: string }) ?? {};
  // Filtra por demandId — sem isso, um fluxo compartilhado por cliente reprocessaria
  // as artes de TODAS as demandas do cliente ao clicar "Executar" numa só.
  const jobParams = extractFlowJobParams(enrichedGraph, briefing, { demandId });

  if (jobParams.length === 0) {
    return NextResponse.json(
      { error: "Nenhum nó saidaArte encontrado no fluxo" },
      { status: 400 }
    );
  }

  // Reaproveita o job já existente de cada art_index (mesmo id) — nunca cria
  // um job novo pro mesmo índice. art_version referencia job_id: um job novo
  // a cada "Executar" deixava a pilha de versões anteriores órfã (a UI só lê
  // versions do job atual), como se artes já geradas tivessem sido perdidas.
  const { data: existingRows } = await supabase
    .from("art_generation_job")
    .select("id, art_index, created_at")
    .eq("demand_id", demandId)
    .order("created_at", { ascending: false });

  const existingByIndex = new Map<number, string>();
  for (const row of existingRows ?? []) {
    if (!existingByIndex.has(row.art_index)) existingByIndex.set(row.art_index, row.id);
  }

  const toInsert = jobParams.filter((p) => !existingByIndex.has(p.art_index));
  const toUpdate = jobParams.filter((p) => existingByIndex.has(p.art_index));

  const [{ error: insertError }, ...updateResults] = await Promise.all([
    toInsert.length > 0
      ? supabase.from("art_generation_job").insert(
          toInsert.map((p) => ({
            demand_id: demandId,
            client_id: demand.client_id,
            art_index: p.art_index,
            status: "queued" as const,
            ephemeral: true,
            params: flowJobParamsToRow(p),
          }))
        )
      : { error: null },
    ...toUpdate.map((p) =>
      supabase
        .from("art_generation_job")
        .update({
          status: "queued" as const,
          error: null,
          ephemeral: true,
          params: flowJobParamsToRow(p),
        })
        .eq("id", existingByIndex.get(p.art_index)!)
    ),
  ]);

  const updateError = updateResults.find((r) => r.error)?.error;
  if (insertError || updateError) {
    return NextResponse.json({ error: (insertError ?? updateError)!.message }, { status: 500 });
  }

  const rows = jobParams;

  // Só as artes feed rodam no "Executar" geral. Stories é disparado manualmente
  // no próprio node (run-node) — ver extractFlowJobParams(includeStory).
  after(() =>
    runWorker(demandId).catch((err: unknown) => {
      console.error("[flow/run] worker error:", err instanceof Error ? err.message : err);
    })
  );

  return NextResponse.json({ ok: true, jobsCreated: rows.length });
}
