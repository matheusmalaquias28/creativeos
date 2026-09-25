import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { PromptReviewBoard } from "@/components/art-director/prompt-review-board";
import { ReadinessChips } from "@/components/art-director/readiness-chips";
import { Badge } from "@/components/ui/badge";
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
      title={title}
      description="Revise a direção de arte antes de gerar as imagens"
      backHref={`/demands/${id}`}
      backLabel="Voltar para demanda"
      eyebrow={
        <Badge variant="pink" className="gap-1">
          <Sparkles />
          Prompts
        </Badge>
      }
      headerContent={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.8125rem] font-semibold text-muted-foreground">
            Kit do cliente
          </span>
          <ReadinessChips readiness={readiness} />
        </div>
      }
    >
      <PromptReviewBoard
        demandId={id}
        initialJobs={jobs}
        initialArts={arts}
        ready={Boolean(readiness?.is_ready)}
        missing={missing}
        hasClientPhotos={clientPhotos.length > 0}
      />
    </DashboardPage>
  );
}
