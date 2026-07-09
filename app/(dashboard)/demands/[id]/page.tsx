import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, GitBranch, Zap } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { DemandDetailStatusBar } from "@/components/demands/demand-detail-status-bar";
import { MagnificSpaceButton } from "@/components/demands/magnific-space-button";
import { CopyArteTextsButton } from "@/components/demands/copy-arte-texts-button";
import { MarkDemandReadOnMount } from "@/components/demands/mark-demand-read-on-mount";
import { DemandClientLinker } from "@/components/demands/demand-client-linker";
import {
  DemandClientAssets,
  DemandClientAssetsEmpty,
} from "@/components/demands/demand-client-assets";
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
import { getDemandById } from "@/services/demands";
import { getClientOptionsForCurrentUser, getClientVisualAssets } from "@/services/clients";
import { getDemandReferenceImages } from "@/services/art-gen";
import { DemandReferenceManager } from "@/components/demands/demand-reference-manager";
import { getAuthUser } from "@/lib/auth/session";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function ExternalHref({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "inline-flex gap-2",
        className
      )}
    >
      {label}
      <ExternalLink className="size-3.5" />
    </a>
  );
}

const arteCardClassName =
  "border-zinc-200 bg-white shadow-sm transition-none dark:border-zinc-600 dark:bg-zinc-100";

const arteTextPrimary = "!text-zinc-950";
const arteTextSecondary = "!text-zinc-700";
const arteTextMuted = "!text-zinc-600";

const arteButtonClassName =
  "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-400 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200";

export default async function DemandDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getAuthUser();

  const [demand, clients] = await Promise.all([
    getDemandById(id),
    getClientOptionsForCurrentUser(),
  ]);
  if (!demand) notFound();

  const [clientAssets, demandRefs] = await Promise.all([
    demand.client_id && user
      ? getClientVisualAssets(demand.client_id, user.id)
      : Promise.resolve(null),
    getDemandReferenceImages(id),
  ]);

  const title = demand.briefing.titulo || demand.client_name_external;

  return (
    <DashboardPage title={title} description="Detalhes da demanda recebida via Make">
      <MarkDemandReadOnMount demandId={id} isNew={demand.is_new} />
      <div className={layout.sectionGap}>
        {/* Status + timer + ações */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DemandDetailStatusBar
            demandId={demand.id}
            status={demand.status}
            startedAt={demand.started_at}
            elapsedSeconds={demand.elapsed_seconds}
          />
<<<<<<< HEAD
          {!demand.client_not_found && (
            <MagnificSpaceButton
              demandId={demand.id}
              status={demand.magnific_space_status}
              spaceUrl={demand.magnific_space_url}
              errorMessage={demand.magnific_space_error}
            />
          )}
=======
          <div className="flex items-center gap-2">
            <Link
              href={`/demands/${id}/flow`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-2"
              )}
            >
              <GitBranch className="size-3.5" />
              Fluxo
            </Link>
            <Link
              href={`/demands/${id}/curation`}
              className={cn(
                buttonVariants({ size: "sm" }),
                "gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg transition-all"
              )}
            >
              <Zap className="size-4 fill-current" />
              Curadoria de artes
            </Link>
          </div>
>>>>>>> 642a2f891e5a2c25d1f311f7b2b1813d7376a95e
        </div>

        <Surface variant="elevated">
          <SurfaceHeader>
            <SurfaceTitle>Cliente</SurfaceTitle>
            <SurfaceDescription>
              Vínculo automático pelo nome externo ou seleção manual
            </SurfaceDescription>
          </SurfaceHeader>
          <SurfaceContent>
            <DemandClientLinker
              demandId={demand.id}
              currentClientId={demand.client_id}
              currentClientName={demand.client_name}
              externalClientName={demand.client_name_external}
              clientNotFound={demand.client_not_found}
              clients={clients}
            />
          </SurfaceContent>
        </Surface>

        <Surface variant="elevated">
          <SurfaceHeader>
            <SurfaceTitle>Logo e referências</SurfaceTitle>
            <SurfaceDescription>
              Materiais visuais cadastrados na página do cliente vinculado
            </SurfaceDescription>
          </SurfaceHeader>
          <SurfaceContent>
            {clientAssets ? (
              <DemandClientAssets
                clientId={clientAssets.clientId}
                clientName={clientAssets.clientName}
                logoUrl={clientAssets.logoUrl}
                references={clientAssets.references}
              />
            ) : (
              <DemandClientAssetsEmpty />
            )}
          </SurfaceContent>
        </Surface>

        <Surface variant="elevated">
          <SurfaceHeader>
            <SurfaceTitle>Referências desta demanda</SurfaceTitle>
            <SurfaceDescription>
              Imagens de referência específicas para esta demanda (além das do perfil do cliente)
            </SurfaceDescription>
          </SurfaceHeader>
          <SurfaceContent>
            <DemandReferenceManager
              demandId={id}
              initialRefs={demandRefs}
              clientRefs={
                clientAssets?.references.map((r) => ({
                  public_url: r.public_url,
                  file_name: r.file_name,
                })) ?? []
              }
            />
          </SurfaceContent>
        </Surface>

        <Surface variant="elevated">
          <SurfaceHeader>
            <SurfaceTitle>Informações gerais</SurfaceTitle>
            <SurfaceDescription>
              Dados enviados pelos gestores na plataforma externa
            </SurfaceDescription>
          </SurfaceHeader>
          <SurfaceContent>
            <dl className="space-y-3">
              <InfoRow label="Cliente (externo)" value={demand.client_name_external} />
              <InfoRow label="Tipo" value={demand.tipo} />
              <InfoRow label="Squad" value={demand.squad} />
              <InfoRow label="Gestor" value={demand.gestor} />
              <InfoRow label="Webdesigner" value={demand.webdesigner} />
              <InfoRow label="Solicitante" value={demand.solicitante} />
              <InfoRow
                label="Criada em"
                value={formatDate(demand.external_created_at ?? demand.created_at)}
              />
              <InfoRow label="Prazo" value={formatDate(demand.due_date)} />
            </dl>
          </SurfaceContent>
        </Surface>

        <Surface variant="elevated">
          <SurfaceHeader>
            <SurfaceTitle>Briefing</SurfaceTitle>
          </SurfaceHeader>
          <SurfaceContent className="space-y-4">
            <dl className="space-y-3">
              <InfoRow label="Título" value={demand.briefing.titulo} />
              <InfoRow label="Instagram" value={demand.briefing.instagramCliente} />
              <InfoRow label="Tipo de arte" value={demand.briefing.tipo} />
              <InfoRow
                label="Quantidade"
                value={
                  demand.briefing.quantidadeArtes != null
                    ? String(demand.briefing.quantidadeArtes)
                    : null
                }
              />
            </dl>
            <div className="flex flex-wrap gap-2">
              <ExternalHref href={demand.briefing.materiaisEditados} label="Materiais editados" />
              <ExternalHref href={demand.briefing.driveMateriais} label="Drive de materiais" />
            </div>
          </SurfaceContent>
        </Surface>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium tracking-heading">Artes ({demand.artes.length})</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Headlines e CTAs definidos no briefing
            </p>
          </div>

          <div className="grid gap-4">
            {demand.artes.map((arte, index) => (
              <Surface key={`${arte.headline}-${index}`} variant="default" className={arteCardClassName}>
                <SurfaceHeader className="flex-row items-start justify-between gap-3 space-y-0">
                  <div className="min-w-0 space-y-1">
                    <SurfaceTitle className={cn("text-base", arteTextPrimary)}>
                      Arte {index + 1}
                    </SurfaceTitle>
                    {arte.cta && (
                      <SurfaceDescription className={arteTextMuted}>
                        CTA: {arte.cta}
                      </SurfaceDescription>
                    )}
                  </div>
                  <CopyArteTextsButton
                    arte={arte}
                    arteIndex={index}
                    className={arteButtonClassName}
                  />
                </SurfaceHeader>
                <SurfaceContent className="space-y-2">
                  {arte.headline && (
                    <p className={cn("text-sm font-medium", arteTextPrimary)}>{arte.headline}</p>
                  )}
                  {arte.subheadline && (
                    <p className={cn("text-sm", arteTextSecondary)}>{arte.subheadline}</p>
                  )}
                  {arte.informacoesExtras && (
                    <p className={cn("text-xs", arteTextMuted)}>{arte.informacoesExtras}</p>
                  )}
                  {arte.linkReferencias && (
                    <ExternalHref
                      href={arte.linkReferencias}
                      label="Referências"
                      className={arteButtonClassName}
                    />
                  )}
                </SurfaceContent>
              </Surface>
            ))}
          </div>
        </section>

        <Link
          href="/demands"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "inline-flex gap-2 text-muted-foreground"
          )}
        >
          <ArrowLeft className="size-4" />
          Voltar para demandas
        </Link>
      </div>
    </DashboardPage>
  );
}
