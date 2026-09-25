import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Images, Sparkles } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { ArtCurationGrid } from "@/components/art-gen/art-curation-grid";
import { GenerateArtsButton } from "@/components/art-gen/generate-arts-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { layout, tones } from "@/lib/design/tokens";
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
      title={title}
      description="Revise, ajuste e aprove as artes geradas"
      backHref={`/demands/${id}`}
      backLabel="Voltar para demanda"
      eyebrow={
        <Badge variant="pink" className="gap-1">
          <Images />
          Curadoria
        </Badge>
      }
      headerAction={
        <>
          <Link
            href={`/demands/${id}/prompts`}
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <Sparkles className="size-4 text-tone-pink" />
            Prompts com IA
          </Link>

          <GenerateArtsButton demandId={id} disabled={!hasClient} />
        </>
      }
    >
      <div className={layout.sectionGap}>
        {!hasClient && (
          <p
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[0.8125rem] font-medium",
              tones.amber.badge
            )}
          >
            <AlertTriangle className="size-3.5 shrink-0" />
            Vincule um cliente à demanda antes de gerar artes.
          </p>
        )}

        {/* Grid de curadoria com Realtime */}
        <ArtCurationGrid demandId={id} initialJobs={jobs} />
      </div>
    </DashboardPage>
  );
}
