import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
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
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <Link
          href={`/demands/${id}`}
          title="Voltar para a demanda"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-[var(--surface-shadow)] transition-premium hover:border-border-strong hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <span
          className={cn(
            "hidden size-9 shrink-0 items-center justify-center rounded-xl sm:flex",
            tones.pink.iconTile
          )}
        >
          <Workflow className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[0.9375rem] font-bold tracking-tight text-foreground">
            {demand.briefing?.titulo || demand.client_name_external}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>
              Fluxo de geração · {numArtes} {numArtes === 1 ? "arte" : "artes"}
            </span>
            {clientId && (
              <Badge variant="cyan" className="h-5 px-2 text-[0.625rem]">
                Fluxo compartilhado do cliente
              </Badge>
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
