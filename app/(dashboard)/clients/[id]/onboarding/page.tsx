import { notFound } from "next/navigation";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { OnboardingForm } from "@/components/clients/onboarding-form";
import { ReadinessChips } from "@/components/art-director/readiness-chips";
import { getAuthUser } from "@/lib/auth/session";
import { getClientById } from "@/services/clients";
import { getOnboardingAnswers, parseOnboardingAnswers } from "@/services/onboarding";
import { getClientPhotos } from "@/services/client-photos";
import { getClientVisualIdentity } from "@/services/visual-identity";
import { getClientArtReadiness, getReferenceAssets } from "@/services/reference-assets";

// O acervo muda por fetch (ReferenceBank → router.refresh), não por navegação.
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * O cadastro do cliente, inteiro, num lugar só.
 *
 * Antes as mesmas imagens eram pedidas em três telas que gravavam em tabelas
 * diferentes — e só uma delas (`client_reference_asset`) contava para a
 * prontidão. Dava para subir cinco artes e continuar "incompleto".
 */
export default async function OnboardingPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return null;

  const client = await getClientById(id, user.id);
  if (!client) notFound();

  const [onboarding, clientPhotos, visualIdentity, referenceAssets, readiness] =
    await Promise.all([
      getOnboardingAnswers(id),
      getClientPhotos(id),
      getClientVisualIdentity(id),
      getReferenceAssets(id),
      getClientArtReadiness(id),
    ]);
  const answers = parseOnboardingAnswers(onboarding);

  return (
    <DashboardPage
      title="Cadastro do cliente"
      description="Logo, imagens, referências e DNA visual. É esta base que alimenta a geração de todas as demandas — cada demanda pode ainda trazer referências próprias."
      backHref={`/clients/${id}`}
      backLabel={client.name}
      headerContent={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.8125rem] font-semibold text-muted-foreground">
            Kit do cliente
          </span>
          <ReadinessChips readiness={readiness} />
        </div>
      }
    >
      <OnboardingForm
        clientId={id}
        defaultValues={{ ...answers, clientPhotos }}
        visualIdentity={visualIdentity}
        referenceAssets={referenceAssets}
        completedAt={onboarding?.completed_at ?? null}
      />
    </DashboardPage>
  );
}
