import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Brain,
  ImageIcon,
  ClipboardList,
  Sparkles,
  ArrowLeft,
  Layers,
} from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { StatCard } from "@/components/dashboard/stat-card";
import { WorkflowModuleCard } from "@/components/clients/workflow-module-card";
import { GenerateBrainButton } from "@/components/creative-brain/generate-brain-button";
import { ClientDisplayStatusBadge } from "@/components/clients/client-display-status-badge";
import { ArchiveClientButton } from "@/components/clients/archive-client-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { layout } from "@/lib/design/tokens";
import { getAuthUser } from "@/lib/auth/session";
import {
  getClientById,
  getClientReferences,
  getLatestCreativeBrain,
} from "@/services/clients";
import {
  getOnboardingAnswers,
  parseOnboardingAnswers,
  isOnboardingComplete,
} from "@/services/onboarding";
import { getClientPhotos } from "@/services/client-photos";
import { ClientPhotosPanel } from "@/components/clients/client-photos-panel";
import { ClientDemandsPanel } from "@/components/demands/client-demands-panel";
import { getDemandsByClientId } from "@/services/demands";
import {
  getClientOpportunityFlags,
  CLIENT_OPPORTUNITY_LABELS,
} from "@/lib/clients/opportunities";
import type { BrandDna } from "@/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return null;

  const client = await getClientById(id, user.id);
  if (!client) notFound();

  const [references, creativeBrain, onboarding, clientPhotos, demands] = await Promise.all([
    getClientReferences(id),
    getLatestCreativeBrain(id),
    getOnboardingAnswers(id),
    getClientPhotos(id),
    getDemandsByClientId(id),
  ]);

  const parsedOnboarding = parseOnboardingAnswers(onboarding);
  const onboardingComplete = isOnboardingComplete(parsedOnboarding);
  const onboardingDone = Boolean(onboarding?.completed_at);
  const logoUrl = parsedOnboarding.logoUrl ?? null;
  const brandDna = creativeBrain?.brand_dna as BrandDna | undefined;
  const hasBrandDna = Boolean(brandDna);
  const totalDemands = demands.length;
  const totalArtes = demands.reduce(
    (acc, demand) => acc + demand.artes.length,
    0
  );
  const opportunityFlags = getClientOpportunityFlags(parsedOnboarding);

  return (
    <DashboardPage
      title={client.name}
      description={`/${client.slug}`}
      headerAction={
        <ArchiveClientButton
          clientId={id}
          isArchived={client.status === "archived"}
        />
      }
    >
      <div className={layout.sectionGap}>
        <div className="flex flex-wrap items-center gap-2">
          <ClientDisplayStatusBadge status={client.status} />
          {creativeBrain && (
            <Badge variant="secondary">
              Creative Brain v{creativeBrain.version}
            </Badge>
          )}
        </div>

        {opportunityFlags.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Oportunidades identificadas
            </p>
            <div className="flex flex-wrap gap-2">
              {opportunityFlags.map((flag) => (
                <Badge
                  key={flag}
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                >
                  {CLIENT_OPPORTUNITY_LABELS[flag]}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            title="Demandas"
            value={totalDemands}
            description="Briefings recebidos via Make"
            icon={ClipboardList}
          />
          <StatCard
            title="Artes"
            value={totalArtes}
            description="Peças solicitadas em todas as demandas"
            icon={Layers}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkflowModuleCard
            title="Onboarding"
            description={
              onboardingDone
                ? "Briefing criativo preenchido"
                : "Formulário criativo e contexto da marca"
            }
            icon={ClipboardList}
            actionLabel={onboardingDone ? "Editar briefing" : "Iniciar onboarding"}
            href={`/clients/${id}/onboarding`}
          />
          <WorkflowModuleCard
            title="Referências"
            description={`${references.length} imagem(ns) enviada(s)`}
            icon={ImageIcon}
            actionLabel="Gerenciar referências"
            href={`/clients/${id}/references`}
          />
          <div className="surface-panel flex flex-col gap-6 p-6 hover-lift md:col-span-2 xl:col-span-1">
            <div className="flex items-start gap-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/45 bg-muted/30">
                <Brain className="size-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="text-sm font-medium tracking-heading text-foreground">
                  Creative Brain
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {creativeBrain
                    ? `Status: ${creativeBrain.status}`
                    : "Brand DNA ainda não gerado"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <GenerateBrainButton
                clientId={id}
                disabled={!onboardingComplete}
              />
              {creativeBrain && (
                <Link
                  href={`/clients/${id}/brain`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" })
                  )}
                >
                  Ver Brand DNA
                </Link>
              )}
            </div>
            {!onboardingComplete && (
              <p className="text-xs text-muted-foreground">
                Complete o onboarding para habilitar a geração.
              </p>
            )}
          </div>
          <WorkflowModuleCard
            title="Prompts"
            description={
              hasBrandDna
                ? "Gerar prompt para Magnific Spaces"
                : "Requer Creative Brain"
            }
            icon={Sparkles}
            actionLabel="Gerar prompt"
            href={hasBrandDna ? `/clients/${id}/creatives` : undefined}
            disabled={!hasBrandDna}
          />
        </div>

        {references.length > 0 && (
          <section className="space-y-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium tracking-heading">
                  Referências visuais
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Prévia das últimas referências
                </p>
              </div>
              <Link
                href={`/clients/${id}/references`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Ver todas
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {references.slice(0, 6).map((ref) => (
                <div
                  key={ref.id}
                  className="aspect-square overflow-hidden rounded-lg border border-border/50 bg-card/30"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ref.public_url}
                    alt={ref.file_name}
                    className="size-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        <ClientDemandsPanel clientId={id} demands={demands} />

        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium tracking-heading">
                Fotos do cliente
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Imagens de produto, espaço e contexto da marca
              </p>
            </div>
          </div>
          <ClientPhotosPanel
            clientId={id}
            clientName={client.name}
            photos={clientPhotos}
            logoUrl={logoUrl}
          />
        </section>

        <Link
          href="/clients"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "inline-flex gap-2 text-muted-foreground"
          )}
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          Voltar para clientes
        </Link>
      </div>
    </DashboardPage>
  );
}
