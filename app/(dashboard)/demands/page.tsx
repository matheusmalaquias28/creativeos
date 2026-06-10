import { AlertTriangle, Inbox } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DemandCard } from "@/components/demands/demand-card";
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

export default async function DemandsPage() {
  const demands = await getDemandsForUser();
  const unmatchedCount = demands.filter((demand) => demand.client_not_found).length;

  return (
    <DashboardShell
      title="Demandas"
      description="Briefings recebidos dos gestores via Make"
    >
      <div className={layout.sectionGap}>
        {unmatchedCount > 0 && (
          <Surface variant="elevated">
            <SurfaceHeader>
              <SurfaceTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600" />
                Clientes pendentes de cadastro
              </SurfaceTitle>
              <SurfaceDescription>
                {unmatchedCount} demanda(s) chegaram com clientes que ainda não existem no
                CreativeOS. Cadastre o cliente com o mesmo nome para vincular automaticamente
                nas próximas demandas.
              </SurfaceDescription>
            </SurfaceHeader>
          </Surface>
        )}

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium tracking-heading">Todas as demandas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {demands.length} registro(s) sincronizado(s)
              </p>
            </div>
            {unmatchedCount > 0 && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-700">
                {unmatchedCount} sem cliente
              </Badge>
            )}
          </div>

          {demands.length === 0 ? (
            <Surface variant="dashed" padding="lg">
              <SurfaceContent className="flex flex-col items-center text-center">
                <Inbox className="mb-4 size-8 text-muted-foreground/50" strokeWidth={1.25} />
                <p className="text-sm font-medium text-foreground">Nenhuma demanda ainda</p>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Configure o webhook do Make para enviar POST em{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    /api/webhooks/make/demands
                  </code>
                </p>
              </SurfaceContent>
            </Surface>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {demands.map((demand) => (
                <DemandCard key={demand.id} demand={demand} />
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
