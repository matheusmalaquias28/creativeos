import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  BarChart3,
  Brain,
  CalendarClock,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardList,
  ImageIcon,
  Layers,
  Sparkles,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { SectionHeader } from "@/components/layout/section-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { WorkflowModuleCard } from "@/components/clients/workflow-module-card";
import { GenerateBrainButton } from "@/components/creative-brain/generate-brain-button";
import { getClientStatusConfig } from "@/components/clients/client-status-indicator";
import { ArchiveClientButton } from "@/components/clients/archive-client-button";
import { ReadinessChips } from "@/components/art-director/readiness-chips";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { layout, tones, type Tone } from "@/lib/design/tokens";
import { getAuthUser } from "@/lib/auth/session";
import {
  getClientById,
  getClientReferences,
  getLatestCreativeBrain,
} from "@/services/clients";
import {
  getOnboardingAnswers,
  parseOnboardingAnswers,
  isClientBriefingComplete,
} from "@/services/onboarding";
import { getClientVisualIdentity, isVisualIdentityReady } from "@/services/visual-identity";
import { getClientPhotos } from "@/services/client-photos";
import { getClientArtReadiness } from "@/services/reference-assets";
import { ClientPhotosPanel } from "@/components/clients/client-photos-panel";
import { ClientDemandsPanel } from "@/components/demands/client-demands-panel";
import { getDemandsByClientId } from "@/services/demands";
import type { BrandDna, CreativeBrainStatus } from "@/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

const BRAIN_STATUS: Record<CreativeBrainStatus, { label: string; tone: Tone }> = {
  generating: { label: "Gerando", tone: "blue" },
  draft: { label: "Rascunho", tone: "amber" },
  approved: { label: "Aprovado", tone: "green" },
  archived: { label: "Arquivado", tone: "slate" },
  failed: { label: "Falhou", tone: "red" },
};

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return null;

  const client = await getClientById(id, user.id);
  if (!client) notFound();

  const [references, creativeBrain, onboarding, clientPhotos, demands, visualIdentity, briefingComplete, readiness] =
    await Promise.all([
    getClientReferences(id),
    getLatestCreativeBrain(id),
    getOnboardingAnswers(id),
    getClientPhotos(id),
    getDemandsByClientId(id),
    getClientVisualIdentity(id),
    isClientBriefingComplete(id),
    getClientArtReadiness(id),
  ]);

  const parsedOnboarding = parseOnboardingAnswers(onboarding);
  const onboardingDone = Boolean(onboarding?.completed_at) || isVisualIdentityReady(visualIdentity);
  const logoUrl = parsedOnboarding.logoUrl ?? visualIdentity.identitySampleUrls[0] ?? null;
  const brandDna = creativeBrain?.brand_dna as BrandDna | undefined;
  const hasBrandDna = Boolean(brandDna);
  const totalDemands = demands.length;
  const totalArtes = demands.reduce(
    (acc, demand) => acc + demand.artes.length,
    0
  );

  // Data de solicitação: usa quando a demanda foi criada no WAR (external_created_at)
  // e cai no created_at do CreativeOS como fallback.
  const requestedAt = (demand: (typeof demands)[number]) =>
    new Date(demand.external_created_at ?? demand.created_at);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLast30 = new Date(now);
  startOfLast30.setDate(startOfLast30.getDate() - 30);
  const demandsThisMonth = demands.filter(
    (demand) => requestedAt(demand) >= startOfMonth
  ).length;
  const demandsLast30 = demands.filter(
    (demand) => requestedAt(demand) >= startOfLast30
  ).length;
  const monthLabel = now.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const opportunityFlags: string[] = [];

  const status = getClientStatusConfig(client.status);
  const statusTone = tones[status.tone];
  const brainStatus = creativeBrain ? BRAIN_STATUS[creativeBrain.status] : null;
  const isReady = Boolean(readiness?.is_ready);
  const readyTone = isReady ? tones.green : tones.amber;
  const identitySummary = isVisualIdentityReady(visualIdentity)
    ? visualIdentity.visualIdentityDna?.summary
    : undefined;

  // Uma única ação principal (violeta) por tela: o próximo passo do fluxo.
  const primaryAction = !onboardingDone
    ? { href: `/clients/${id}/onboarding`, label: "Iniciar onboarding", icon: ClipboardList }
    : hasBrandDna
      ? { href: `/clients/${id}/creatives`, label: "Gerar prompt", icon: Sparkles }
      : null;
  const PrimaryIcon = primaryAction?.icon;

  return (
    <DashboardPage
      title={client.name}
      backHref="/clients"
      backLabel="Clientes"
      eyebrow={
        <>
          <Badge variant={status.tone} title={status.title}>
            <span className={cn("size-1.5 rounded-full", statusTone.dot)} />
            {status.label}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">/{client.slug}</span>
          {creativeBrain && (
            <Badge variant="violet">
              <Brain />
              Creative Brain v{creativeBrain.version}
            </Badge>
          )}
        </>
      }
      headerAction={
        <>
          <ArchiveClientButton
            clientId={id}
            isArchived={client.status === "archived"}
          />
          {primaryAction && PrimaryIcon && (
            <Link href={primaryAction.href} className={cn(buttonVariants({ size: "sm" }))}>
              <PrimaryIcon className="size-3.5" strokeWidth={2.25} />
              {primaryAction.label}
            </Link>
          )}
        </>
      }
    >
      <div className={layout.sectionGap}>
        {opportunityFlags.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[0.8125rem] font-semibold text-muted-foreground">
              Oportunidades identificadas
            </p>
            <div className="flex flex-wrap gap-2">
              {opportunityFlags.map((flag) => (
                <Badge key={flag} variant="amber">
                  {flag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Fluxo de trabalho + prontidão */}
        <section className="space-y-4">
          <SectionHeader
            title="Fluxo de trabalho"
            description="Do briefing ao prompt — cada etapa libera a próxima"
            icon={Workflow}
            tone="violet"
          />
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="grid gap-4 sm:grid-cols-2 xl:col-span-2">
              <WorkflowModuleCard
                title="Onboarding"
                description={
                  onboardingDone
                    ? "Logo, fotos e DNA visual configurados"
                    : "Logo, fotos e extrator de identidade visual"
                }
                icon={ClipboardList}
                tone="orange"
                status={
                  onboardingDone
                    ? { label: "Concluído", tone: "green" }
                    : { label: "Pendente", tone: "amber" }
                }
                actionLabel={onboardingDone ? "Editar briefing" : "Iniciar onboarding"}
                href={`/clients/${id}/onboarding`}
              />
              <WorkflowModuleCard
                title="Referências"
                description={`${references.length} imagem(ns) enviada(s)`}
                icon={ImageIcon}
                tone="cyan"
                actionLabel="Gerenciar referências"
                href={`/clients/${id}/references`}
              />
              <WorkflowModuleCard
                title="Creative Brain"
                description={
                  <>
                    {creativeBrain ? "Brand DNA estruturado do cliente" : "Brand DNA ainda não gerado"}
                    {!briefingComplete && (
                      <span className="mt-1 block text-xs">
                        Extraia a identidade visual no briefing para habilitar a geração.
                      </span>
                    )}
                  </>
                }
                icon={Brain}
                tone="violet"
                status={brainStatus ?? undefined}
                footer={
                  <>
                    <GenerateBrainButton
                      clientId={id}
                      disabled={!briefingComplete}
                      size="sm"
                      variant={primaryAction ? "outline" : "default"}
                    />
                    {creativeBrain && (
                      <Link
                        href={`/clients/${id}/brain`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                      >
                        Ver Brand DNA
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                    )}
                  </>
                }
              />
              <WorkflowModuleCard
                title="Prompts"
                description={
                  hasBrandDna
                    ? "Gerar prompt para Magnific Spaces"
                    : "Requer Creative Brain"
                }
                icon={Sparkles}
                tone="pink"
                status={
                  hasBrandDna
                    ? { label: "Disponível", tone: "green" }
                    : { label: "Bloqueado", tone: "slate" }
                }
                actionLabel="Gerar prompt"
                href={hasBrandDna ? `/clients/${id}/creatives` : undefined}
                disabled={!hasBrandDna}
              />
            </div>

            <Surface className="flex flex-col gap-4 p-5">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    readyTone.iconTile
                  )}
                >
                  {isReady ? (
                    <CheckCircle2 className="size-[1.125rem]" strokeWidth={2} />
                  ) : (
                    <TriangleAlert className="size-[1.125rem]" strokeWidth={2} />
                  )}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[0.8125rem] font-semibold text-muted-foreground">
                    Prontidão para artes
                  </p>
                  <p className={cn("text-[0.9375rem] font-bold tracking-tight", readyTone.text)}>
                    {isReady ? "Pronto para gerar artes" : "Cadastro de materiais incompleto"}
                  </p>
                </div>
              </div>

              <ReadinessChips readiness={readiness} />

              {identitySummary && (
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">DNA visual</p>
                  <p className="text-[0.8125rem] leading-relaxed text-foreground/90">
                    {identitySummary.slice(0, 180)}
                    {identitySummary.length > 180 ? "…" : ""}
                  </p>
                </div>
              )}

              {!isReady && (
                <Link
                  href={`/clients/${id}/onboarding`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-auto w-fit")}
                >
                  Completar cadastro
                </Link>
              )}
            </Surface>
          </div>
        </section>

        {/* Produção */}
        <section className="space-y-4">
          <SectionHeader
            title="Produção"
            description="Demandas e artes solicitadas por este cliente"
            icon={BarChart3}
            tone="blue"
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Demandas no mês"
              value={demandsThisMonth}
              description={`Solicitadas em ${monthLabel}`}
              icon={CalendarClock}
              tone={demandsThisMonth > 0 ? "green" : "slate"}
              className="stagger-1 animate-in-soft"
            />
            <StatCard
              title="Últimos 30 dias"
              value={demandsLast30}
              description="Demandas solicitadas no período"
              icon={CalendarDays}
              tone="blue"
              className="stagger-2 animate-in-soft"
            />
            <StatCard
              title="Demandas no total"
              value={totalDemands}
              description="Briefings recebidos via Make"
              icon={ClipboardList}
              tone="violet"
              className="stagger-3 animate-in-soft"
            />
            <StatCard
              title="Artes"
              value={totalArtes}
              description="Peças solicitadas em todas as demandas"
              icon={Layers}
              tone="pink"
              className="stagger-4 animate-in-soft"
            />
          </div>
        </section>

        <ClientDemandsPanel clientId={id} demands={demands} />

        {references.length > 0 && (
          <section className="space-y-4">
            <SectionHeader
              title="Referências visuais"
              description="Prévia das últimas referências"
              icon={ImageIcon}
              tone="cyan"
              action={
                <Link
                  href={`/clients/${id}/references`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-foreground")}
                >
                  Ver todas
                  <ArrowUpRight className="size-3.5" />
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {references.slice(0, 6).map((ref) => (
                <div
                  key={ref.id}
                  className="aspect-square overflow-hidden rounded-xl border border-border bg-surface"
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

        <section className="space-y-4">
          <SectionHeader
            title="Fotos do cliente"
            description="Imagens de produto, espaço e contexto da marca"
            icon={Camera}
            tone="orange"
          />
          <Surface padding="md">
            <ClientPhotosPanel
              clientId={id}
              clientName={client.name}
              photos={clientPhotos}
              logoUrl={logoUrl}
            />
          </Surface>
        </section>
      </div>
    </DashboardPage>
  );
}
