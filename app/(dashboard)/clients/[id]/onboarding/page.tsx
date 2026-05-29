import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
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
import { createClient } from "@/lib/supabase/server";
import { getClientById } from "@/services/clients";
import {
  getOnboardingAnswers,
  parseOnboardingAnswers,
} from "@/services/onboarding";
import { getClientPhotos } from "@/services/client-photos";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OnboardingPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const client = await getClientById(id, user.id);
  if (!client) notFound();

  const [onboarding, clientPhotos] = await Promise.all([
    getOnboardingAnswers(id),
    getClientPhotos(id),
  ]);
  const answers = parseOnboardingAnswers(onboarding);

  return (
    <DashboardShell
      title="Onboarding criativo"
      description={`${client.name} · contexto de marca para IA`}
    >
      <div className={layout.sectionGap}>
        <Surface variant="elevated">
          <SurfaceHeader>
            <SurfaceTitle>Briefing da marca</SurfaceTitle>
            <SurfaceDescription>
              Preencha o formulário para alimentar a geração do Creative Brain.
              As respostas são salvas automaticamente.
            </SurfaceDescription>
          </SurfaceHeader>
          <SurfaceContent>
            <OnboardingForm
              clientId={id}
              defaultValues={{ ...answers, clientPhotos }}
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
    </DashboardShell>
  );
}
