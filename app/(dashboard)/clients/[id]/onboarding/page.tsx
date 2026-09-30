import { notFound } from "next/navigation";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { OnboardingForm } from "@/components/clients/onboarding-form";
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
      description="Cadastre a logo e escolha a liberdade visual. A copy vem da demanda; fotos, referências e identidade são opcionais."
      backHref={`/clients/${id}`}
      backLabel={client.name}
    >
      <OnboardingForm
        clientId={id}
        defaultValues={{ ...answers, clientPhotos }}
        visualIdentity={visualIdentity}
        completedAt={onboarding?.completed_at ?? null}
      />
    </DashboardPage>
  );
}
