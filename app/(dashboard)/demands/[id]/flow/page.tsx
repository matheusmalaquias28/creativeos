import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDemandById } from "@/services/demands";
import { createAdminClient } from "@/lib/supabase/admin";
import { FlowCanvas } from "@/components/flow/flow-canvas";
import { gerarFluxoDaDemanda } from "@/lib/flow/generator";
import type { FlowGraph } from "@/lib/flow/types";

type PageProps = { params: Promise<{ id: string }> };

type CreativeProfileRow = {
  logo_url: string | null;
  style_reference_urls: string[] | null;
};

async function loadFlowData(demandId: string, clientId: string | null) {
  const supabase = createAdminClient();

  const [demandRow, profileRow] = await Promise.all([
    supabase
      .from("creative_demands")
      .select("flow_graph")
      .eq("id", demandId)
      .single(),
    clientId
      ? supabase
          .from("client_creative_profile")
          .select("logo_url, style_reference_urls")
          .eq("client_id", clientId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const savedGraph = (demandRow.data?.flow_graph as FlowGraph | null) ?? null;
  const profile = profileRow.data as CreativeProfileRow | null;

  return { savedGraph, profile };
}

/** Enriches the graph's source nodes with actual image URLs. */
function enrichGraph(
  graph: FlowGraph,
  profile: CreativeProfileRow | null
): FlowGraph {
  if (!profile) return graph;

  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      if (n.type === "clienteLogo") {
        return { ...n, data: { ...n.data, logoUrl: profile.logo_url } };
      }
      if (n.type === "clienteReferencias") {
        return {
          ...n,
          data: {
            ...n.data,
            referenceUrls: profile.style_reference_urls ?? [],
          },
        };
      }
      return n;
    }),
  };
}

export default async function DemandFlowPage({ params }: PageProps) {
  const { id } = await params;
  const demand = await getDemandById(id);
  if (!demand) notFound();

  const { savedGraph, profile } = await loadFlowData(id, demand.client_id ?? null);

  const numArtes =
    demand.briefing?.quantidadeArtes ??
    (demand.artes?.length > 0 ? demand.artes.length : 1);

  // Build initial graph: saved (enriched) or fresh default (enriched)
  const baseGraph =
    savedGraph ?? gerarFluxoDaDemanda(demand, numArtes);
  const initialGraph = enrichGraph(baseGraph, profile);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-white/6 px-6 py-3">
        <Link
          href={`/demands/${id}`}
          className="flex size-7 items-center justify-center rounded-lg border border-white/8 bg-white/4 text-muted-foreground/60 transition-colors hover:text-foreground/80"
        >
          <ArrowLeft className="size-3.5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium text-foreground">
            {demand.briefing?.titulo || demand.client_name_external}
          </h1>
          <p className="text-[0.6875rem] text-muted-foreground/50">
            Fluxo de geração · {numArtes}{" "}
            {numArtes === 1 ? "arte" : "artes"}
            {savedGraph && (
              <span className="ml-2 text-emerald-400/60">· fluxo salvo</span>
            )}
          </p>
        </div>
      </header>

      {/* Canvas — fills remaining height */}
      <div className="min-h-0 flex-1">
        <FlowCanvas
          demanda={demand}
          numArtes={numArtes}
          initialGraph={initialGraph}
          clientProfile={{
            logoUrl: profile?.logo_url ?? null,
            referenceUrls: profile?.style_reference_urls ?? [],
          }}
        />
      </div>
    </div>
  );
}
