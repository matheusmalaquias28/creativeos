import Link from "next/link";
import { Workflow, Maximize2, ImageOff } from "lucide-react";
import { SectionHeader } from "@/components/layout/section-header";
import { Surface } from "@/components/ui/surface";
import { FlowCanvas } from "@/components/flow/flow-canvas";
import { getDemandById } from "@/services/demands";
import { getOrCreateClientFlowGraph } from "@/services/flow";
import { enrichFlowGraphWithProfile } from "@/lib/flow/enrich-graph";
import { loadFlowCreativeProfile } from "@/lib/flow/load-creative-profile";
import { demandHasMaterial } from "@/services/space-material";

type Demand = NonNullable<Awaited<ReturnType<typeof getDemandById>>>;

/**
 * Seção "Space" da página da demanda: o canvas node-based próprio (geração via
 * GPT Image). Só monta se o cliente tiver material (gate); senão mostra um
 * estado vazio pedindo o material. Montar o board não custa — só a geração.
 */
export async function DemandSpaceSection({ demand }: { demand: Demand }) {
  const numArtes =
    demand.briefing?.quantidadeArtes ??
    (demand.artes?.length > 0 ? demand.artes.length : 1);

  const hasMaterial = await demandHasMaterial(demand.client_id ?? null);

  if (!hasMaterial) {
    return (
      <section className="space-y-4">
        <SectionHeader
          icon={Workflow}
          tone="pink"
          title="Space"
          description="Canvas de geração — artes a partir do material do cliente"
        />
        <Surface className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
          <ImageOff className="size-6 text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground">Sem material do cliente</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Cadastre pelo menos a logo do cliente (e, idealmente, referências do
            acervo) para montar e gerar o Space desta demanda.
          </p>
        </Surface>
      </section>
    );
  }

  const [{ graph }, profile] = await Promise.all([
    getOrCreateClientFlowGraph(demand, numArtes),
    loadFlowCreativeProfile(demand.client_id ?? null),
  ]);

  const initialGraph = enrichFlowGraphWithProfile(graph, profile);

  return (
    <section className="space-y-4">
      <SectionHeader
        icon={Workflow}
        tone="pink"
        title="Space"
        description="Canvas de geração — edite os nós, gere e baixe as artes"
        action={
          <Link
            href={`/demands/${demand.id}/flow`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-premium hover:border-border-strong hover:bg-accent hover:text-foreground"
          >
            <Maximize2 className="size-3.5" />
            Tela cheia
          </Link>
        }
      />
      <Surface className="overflow-hidden p-0">
        <div className="h-[70vh] min-h-[480px] w-full">
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
      </Surface>
    </section>
  );
}
