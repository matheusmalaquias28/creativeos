import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Brain,
  ImageIcon,
  ClipboardList,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { WorkflowModuleCard } from "@/components/clients/workflow-module-card";
import { GenerateBrainButton } from "@/components/creative-brain/generate-brain-button";
import {
  ClientStatusIndicator,
  getClientStatusConfig,
} from "@/components/clients/client-status-indicator";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { layout } from "@/lib/design/tokens";
import { createClient } from "@/lib/supabase/server";
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
import type { BrandDna } from "@/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const client = await getClientById(id, user.id);
  if (!client) notFound();

  const [references, creativeBrain, onboarding, clientPhotos] = await Promise.all([
    getClientReferences(id),
    getLatestCreativeBrain(id),
    getOnboardingAnswers(id),
    getClientPhotos(id),
  ]);

  const parsedOnboarding = parseOnboardingAnswers(onboarding);
  const onboardingComplete = isOnboardingComplete(parsedOnboarding);
  const onboardingDone = Boolean(onboarding?.completed_at);
  const logoUrl = parsedOnboarding.logoUrl ?? null;
  const brandDna = creativeBrain?.brand_dna as BrandDna | undefined;
  const hasBrandDna = Boolean(brandDna);

  return (
    <DashboardShell
      title={client.name}
      description={`/${client.slug}`}
    >
      <div className={layout.sectionGap}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-2 pr-2.5">
            <ClientStatusIndicator status={client.status} size="sm" />
            {getClientStatusConfig(client.status).label}
          </Badge>
          {onboardingDone && (
            <Badge variant="secondary">Onboarding concluído</Badge>
          )}
          {creativeBrain && (
            <Badge variant="secondary">
              Creative Brain v{creativeBrain.version}
            </Badge>
          )}
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
          <ClientPhotosPanel clientId={id} photos={clientPhotos} logoUrl={logoUrl} />
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
    </DashboardShell>
  );
}
