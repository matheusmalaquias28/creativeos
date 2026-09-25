import { AlertTriangle, Archive, Inbox, LayoutGrid } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { DemandCard } from "@/components/demands/demand-card";
import { DemandsKanbanBoard } from "@/components/demands/demands-kanban-board";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { layout, tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { getDemandsForUser } from "@/services/demands";
import { getClientOptionsForCurrentUser } from "@/services/clients";

// Cobre a geração de Magnific Space disparada por generateMagnificSpaceAction
// (upload de fotos + create + edit + polling pode passar de 1 minuto).
export const maxDuration = 300;

type SearchParams = { archived?: string };

export default async function DemandsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { archived: archivedParam } = await searchParams;
  const showArchived = archivedParam === "1";

  const [demands, clients] = await Promise.all([
    getDemandsForUser(showArchived),
    getClientOptionsForCurrentUser(),
  ]);

  const unmatchedCount = demands.filter((d) => d.client_not_found).length;

  return (
    <DashboardPage
      title="Demandas"
      description="Briefings recebidos dos gestores via Make, do recebimento à entrega."
      headerContent={
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            aria-label="Filtrar demandas"
            value={showArchived ? "archived" : "active"}
            options={[
              {
                value: "active",
                label: "Ativas",
                href: "/demands",
                icon: <LayoutGrid className="size-3.5" />,
                count: showArchived ? undefined : demands.length,
              },
              {
                value: "archived",
                label: "Arquivadas",
                href: "/demands?archived=1",
                icon: <Archive className="size-3.5" />,
                count: showArchived ? demands.length : undefined,
              },
            ]}
          />

          {unmatchedCount > 0 && (
            <span
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold",
                tones.amber.badge
              )}
            >
              <AlertTriangle className="size-3.5 shrink-0" />
              {unmatchedCount} {showArchived ? "sem cliente" : `pendente${unmatchedCount === 1 ? "" : "s"} de cadastro`}
            </span>
          )}
        </div>
      }
    >
      <div className={layout.sectionGap}>
        {/* Kanban (ativas) */}
        {!showArchived &&
          (demands.length === 0 ? (
            <EmptyState
              icon={Inbox}
              tone="cyan"
              title="Nenhuma demanda ainda"
              description={
                <>
                  Configure o webhook do Make para enviar POST em{" "}
                  <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                    /api/webhooks/make/demands
                  </code>
                </>
              }
            />
          ) : (
            <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10">
              <DemandsKanbanBoard initialDemands={demands} clients={clients} />
            </div>
          ))}

        {/* Arquivadas (grade) */}
        {showArchived &&
          (demands.length === 0 ? (
            <EmptyState
              icon={Archive}
              tone="slate"
              title="Nenhuma demanda arquivada"
              description="Demandas arquivadas manualmente aparecem aqui."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {demands.map((demand) => (
                <DemandCard key={demand.id} demand={demand} clients={clients} />
              ))}
            </div>
          ))}
      </div>
    </DashboardPage>
  );
}
