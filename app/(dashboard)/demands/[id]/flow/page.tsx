import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDemandById } from "@/services/demands";
import { getOrCreateClientFlowGraph } from "@/services/flow";
import { enrichFlowGraphWithProfile } from "@/lib/flow/enrich-graph";
import { loadFlowCreativeProfile } from "@/lib/flow/load-creative-profile";
import { FlowCanvas } from "@/components/flow/flow-canvas";

type PageProps = { params: Promise<{ id: string }> };

export default async function DemandFlowPage({ params }: PageProps) {
  const { id } = await params;
  const demand = await getDemandById(id);
  if (!demand) notFound();

  const numArtes =
    demand.briefing?.quantidadeArtes ??
    (demand.artes?.length > 0 ? demand.artes.length : 1);

  const [{ graph, clientId }, profile] = await Promise.all([
    getOrCreateClientFlowGraph(demand, numArtes),
    loadFlowCreativeProfile(demand.client_id ?? null),
  ]);

  const initialGraph = enrichFlowGraphWithProfile(graph, profile);

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
            {clientId && (
              <span className="ml-2 text-emerald-400/60">· fluxo compartilhado do cliente</span>
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
