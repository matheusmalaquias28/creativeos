import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { OnboardingForm } from "@/components/clients/onboarding-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Surface,
  SurfaceContent,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { layout } from "@/lib/design/tokens";
import { getAuthUser } from "@/lib/auth/session";
import { getClientById } from "@/services/clients";
import { getOnboardingAnswers, parseOnboardingAnswers } from "@/services/onboarding";
import { getClientPhotos } from "@/services/client-photos";
import { getClientVisualIdentity } from "@/services/visual-identity";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OnboardingPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return null;

  const client = await getClientById(id, user.id);
  if (!client) notFound();

  const [onboarding, clientPhotos, visualIdentity] = await Promise.all([
    getOnboardingAnswers(id),
    getClientPhotos(id),
    getClientVisualIdentity(id),
  ]);
  const answers = parseOnboardingAnswers(onboarding);

  return (
    <DashboardPage
      title="Briefing do cliente"
      description={`${client.name} · logo, fotos e DNA visual`}
    >
      <div className={layout.sectionGap}>
        <Surface variant="elevated">
          <SurfaceHeader>
            <SurfaceTitle>Ativos visuais</SurfaceTitle>
            <SurfaceDescription>
              Envie a logo, fotos do cliente e uma arte de referência. A IA extrai
              a identidade visual e usa como memória em todas as demandas.
            </SurfaceDescription>
          </SurfaceHeader>
          <SurfaceContent>
            <OnboardingForm
              clientId={id}
              defaultValues={{ ...answers, clientPhotos }}
              visualIdentity={visualIdentity}
              completedAt={onboarding?.completed_at ?? null}
            />
          </SurfaceContent>
        </Surface>

        <Link
          href={`/clients/${id}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "inline-flex gap-2 text-muted-foreground"
          )}
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          Voltar ao cliente
        </Link>
      </div>
    </DashboardPage>
  );
}
