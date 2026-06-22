import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { ArtCurationGrid } from "@/components/art-gen/art-curation-grid";
import { GenerateArtsButton } from "@/components/art-gen/generate-arts-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDemandById } from "@/services/demands";
import { getJobsForDemand } from "@/services/art-gen";

// Sempre busca dados frescos — artes mudam enquanto o worker processa
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function ArtCurationPage({ params }: PageProps) {
  const { id } = await params;

  const [demand, jobs] = await Promise.all([
    getDemandById(id),
    getJobsForDemand(id),
  ]);

  if (!demand) notFound();

  const title = demand.briefing.titulo || demand.client_name_external;
  const hasClient = Boolean(demand.client_id);

  return (
    <DashboardPage
      title={`Curadoria: ${title}`}
      description="Revise, ajuste e aprove as artes geradas"
    >
      <div className="space-y-6">
        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/demands/${id}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-2 text-muted-foreground"
            )}
          >
            <ArrowLeft className="size-4" />
            Voltar para demanda
          </Link>

          <GenerateArtsButton
            demandId={id}
            disabled={!hasClient}
          />
        </div>

        {!hasClient && (
          <p className="text-sm text-amber-600">
            Vincule um cliente à demanda antes de gerar artes.
          </p>
        )}

        {/* Grid de curadoria com Realtime */}
        <ArtCurationGrid demandId={id} initialJobs={jobs} />
      </div>
    </DashboardPage>
  );
}
