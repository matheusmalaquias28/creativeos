import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { DemandDetailStatusBar } from "@/components/demands/demand-detail-status-bar";
import { MagnificSpaceButton } from "@/components/demands/magnific-space-button";
import { MarkDemandReadOnMount } from "@/components/demands/mark-demand-read-on-mount";
import {
  DemandClientAssets,
  DemandClientAssetsEmpty,
} from "@/components/demands/demand-client-assets";
import { DemandArteFeed } from "@/components/demands/demand-arte-feed";
import { DemandReferenceManager } from "@/components/demands/demand-reference-manager";
import { CreativeBriefPanel } from "@/components/demands/creative-brief-panel";
import { buttonVariants } from "@/components/ui/button";
import {
  Surface,
  SurfaceContent,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { getDemandById } from "@/services/demands";
import {
  getClientOptionsForCurrentUser,
  getClientVisualAssets,
} from "@/services/clients";
import { getDemandReferenceImages } from "@/services/art-gen";
import { getAuthUser } from "@/lib/auth/session";
import { displayExternalClientName } from "@/lib/demands/normalize-client-name";

export const maxDuration = 300;

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MetaItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground/70">{label}</span>
      <span className="text-foreground/85">{value}</span>
    </span>
  );
}

function ExternalHref({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-foreground/85 underline-offset-2 hover:underline"
    >
      {label}
      <ExternalLink className="size-3" />
    </a>
  );
}

function instagramHref(value: string): string {
  if (value.startsWith("http")) return value;
  const handle = value.replace(/^@/, "");
  return `https://instagram.com/${handle}`;
}

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

  const title =
    demand.briefing.titulo ||
    displayExternalClientName(demand.client_name_external) ||
    "Demanda";
  const instagram = demand.briefing.instagramCliente.trim();

  return (
    <DashboardPage title={title}>
      <MarkDemandReadOnMount demandId={id} isNew={demand.is_new} />
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <DemandDetailStatusBar
              demandId={demand.id}
              status={demand.status}
              startedAt={demand.started_at}
              elapsedSeconds={demand.elapsed_seconds}
              currentClientId={demand.client_id}
              currentClientName={demand.client_name}
              externalClientName={demand.client_name_external}
              clientNotFound={demand.client_not_found}
              clients={clients}
            />
          </div>
          {!demand.client_not_found && (
            <MagnificSpaceButton
              demandId={demand.id}
              status={demand.magnific_space_status}
              spaceUrl={demand.magnific_space_url}
              errorMessage={demand.magnific_space_error}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <MetaItem label="Tipo" value={demand.tipo ?? demand.briefing.tipo} />
          <MetaItem
            label="Artes"
            value={
              demand.briefing.quantidadeArtes != null
                ? String(demand.briefing.quantidadeArtes)
                : String(demand.artes.length)
            }
          />
          <MetaItem label="Squad" value={demand.squad} />
          <MetaItem label="Gestor" value={demand.gestor} />
          <MetaItem label="Webdesigner" value={demand.webdesigner} />
          <MetaItem label="Solicitante" value={demand.solicitante} />
          <MetaItem
            label="Criada"
            value={formatDate(demand.external_created_at ?? demand.created_at)}
          />
          <MetaItem label="Prazo" value={formatDate(demand.due_date)} />
          {instagram ? (
            <a
              href={instagramHref(instagram)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-foreground/85 underline-offset-2 hover:underline"
            >
              Instagram
              <ExternalLink className="size-3" />
            </a>
          ) : null}
          <ExternalHref
            href={demand.briefing.materiaisEditados}
            label="Materiais"
          />
          <ExternalHref
            href={demand.briefing.driveMateriais}
            label="Drive"
          />
        </div>

        <Surface variant="elevated">
          <SurfaceHeader className="pb-4">
            <SurfaceTitle>Logo e referências</SurfaceTitle>
            <SurfaceDescription>
              Materiais do cliente e referências específicas desta demanda
            </SurfaceDescription>
          </SurfaceHeader>
          <SurfaceContent className="space-y-6">
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
            <DemandReferenceManager
              demandId={id}
              initialRefs={demandRefs}
              showClientRefs={false}
              clientRefs={
                clientAssets?.references.map((r) => ({
                  public_url: r.public_url,
                  file_name: r.file_name,
                })) ?? []
              }
            />
          </SurfaceContent>
        </Surface>


        <CreativeBriefPanel
          demandId={id}
          hasClient={Boolean(demand.client_id)}
        />

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium tracking-heading">
              Briefing das artes ({demand.artes.length})
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Headlines e CTAs no formato 3:4
            </p>
          </div>
          <DemandArteFeed demandId={id} artes={demand.artes} />
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
