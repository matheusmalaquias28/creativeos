import Link from "next/link";
import { AlertTriangle, Archive, Inbox } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { DemandCard } from "@/components/demands/demand-card";
import { DemandsKanbanBoard } from "@/components/demands/demands-kanban-board";
import { Badge } from "@/components/ui/badge";
import {
  Surface,
  SurfaceContent,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/ui/surface";
import { layout } from "@/lib/design/tokens";
import { getDemandsForUser } from "@/services/demands";
import { getClientOptionsForCurrentUser } from "@/services/clients";

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
      description="Briefings recebidos dos gestores via Make"
    >
      <div className={layout.sectionGap}>
        {/* Tabs ativas / arquivadas */}
        <div className="flex gap-1 rounded-xl border border-border/40 bg-muted/30 p-1 w-fit">
          <Link
            href="/demands"
            className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
              !showArchived
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Ativas
          </Link>
          <Link
            href="/demands?archived=1"
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
              showArchived
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Archive className="size-3.5" />
            Arquivadas
          </Link>
        </div>

        {/* Aviso de clientes não encontrados */}
        {unmatchedCount > 0 && !showArchived && (
          <Surface variant="elevated">
            <SurfaceHeader>
              <SurfaceTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600" />
                Clientes pendentes de cadastro
              </SurfaceTitle>
              <SurfaceDescription>
                {unmatchedCount} demanda(s) chegaram com clientes que ainda não existem
                no CreativeOS.
              </SurfaceDescription>
            </SurfaceHeader>
          </Surface>
        )}

        {/* Lista agrupada (ativas) */}
        {!showArchived && (
          <>
            {demands.length === 0 ? (
              <Surface variant="dashed" padding="lg">
                <SurfaceContent className="flex flex-col items-center text-center">
                  <Inbox
                    className="mb-4 size-8 text-muted-foreground/50"
                    strokeWidth={1.25}
                  />
                  <p className="text-sm font-medium text-foreground">
                    Nenhuma demanda ainda
                  </p>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                    Configure o webhook do Make para enviar POST em{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      /api/webhooks/make/demands
                    </code>
                  </p>
                </SurfaceContent>
              </Surface>
            ) : (
              <div className="-mx-8 px-8 lg:-mx-10 lg:px-10 overflow-x-auto">
                <DemandsKanbanBoard initialDemands={demands} clients={clients} />
              </div>
            )}
          </>
        )}

        {/* Lista arquivadas (flat) */}
        {showArchived && (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium tracking-heading">
                  Demandas arquivadas
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {demands.length} registro(s)
                </p>
              </div>
              {unmatchedCount > 0 && (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 text-amber-700"
                >
                  {unmatchedCount} sem cliente
                </Badge>
              )}
            </div>

            {demands.length === 0 ? (
              <Surface variant="dashed" padding="lg">
                <SurfaceContent className="flex flex-col items-center text-center">
                  <Archive
                    className="mb-4 size-8 text-muted-foreground/50"
                    strokeWidth={1.25}
                  />
                  <p className="text-sm font-medium text-foreground">
                    Nenhuma demanda arquivada
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Demandas arquivadas manualmente aparecem aqui.
                  </p>
                </SurfaceContent>
              </Surface>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {demands.map((demand) => (
                  <DemandCard key={demand.id} demand={demand} clients={clients} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </DashboardPage>
  );
}
