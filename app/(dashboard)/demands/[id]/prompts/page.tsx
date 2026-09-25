import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { PromptReviewBoard } from "@/components/art-director/prompt-review-board";
import { ReadinessChips } from "@/components/art-director/readiness-chips";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDemandById } from "@/services/demands";
import { getCurrentArtUrls, getPromptJobsForDemand } from "@/services/art-director";
import { getClientArtReadiness, missingForReadiness } from "@/services/reference-assets";
import { getClientPhotos } from "@/services/client-photos";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function PromptsPage({ params }: PageProps) {
  const { id } = await params;

  const demand = await getDemandById(id);
  if (!demand) notFound();

  const [jobs, readiness, arts, clientPhotos] = await Promise.all([
    getPromptJobsForDemand(id),
    demand.client_id ? getClientArtReadiness(demand.client_id) : Promise.resolve(null),
    getCurrentArtUrls(id),
    demand.client_id ? getClientPhotos(demand.client_id) : Promise.resolve([]),
  ]);

  const title = demand.briefing.titulo || demand.client_name_external;
  const missing = demand.client_id
    ? missingForReadiness(readiness)
    : ["cliente vinculado à demanda"];

  return (
    <DashboardPage
      title={`Prompts: ${title}`}
      description="Revise a direção de arte antes de gerar as imagens"
    >
      <div className="space-y-6">
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
          <ReadinessChips readiness={readiness} />
        </div>

        <PromptReviewBoard
          demandId={id}
          initialJobs={jobs}
          initialArts={arts}
          ready={Boolean(readiness?.is_ready)}
          missing={missing}
          hasClientPhotos={clientPhotos.length > 0}
        />
      </div>
    </DashboardPage>
  );
}
