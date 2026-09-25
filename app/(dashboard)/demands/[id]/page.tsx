import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  ImageIcon,
  Images,
  Sparkles,
} from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { SectionHeader } from "@/components/layout/section-header";
import { DemandDetailStatusBar } from "@/components/demands/demand-detail-status-bar";
import { MagnificSpaceButton } from "@/components/demands/magnific-space-button";
import { DemandDeliverDialog } from "@/components/demands/demand-deliver-dialog";
import { MarkDemandReadOnMount } from "@/components/demands/mark-demand-read-on-mount";
import {
  DemandClientAssets,
  DemandClientAssetsEmpty,
} from "@/components/demands/demand-client-assets";
import { DemandArteFeed } from "@/components/demands/demand-arte-feed";
import { DemandReferenceManager } from "@/components/demands/demand-reference-manager";
import { CreativeBriefPanel } from "@/components/demands/creative-brief-panel";
import { buttonVariants } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { layout, tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { getDemandById } from "@/services/demands";
import {
  getClientOptionsForCurrentUser,
  getClientVisualAssets,
} from "@/services/clients";
import { getDemandReferenceImages } from "@/services/art-gen";
import { getDemandExportFiles } from "@/services/demand-export";
import { getAuthUser } from "@/lib/auth/session";
import { displayExternalClientName } from "@/lib/demands/normalize-client-name";
import {
  collectDemandDriveUrls,
  isMateriaisEditadosMissing,
  resolveDemandDriveFolder,
} from "@/lib/export/drive-folder";
import { getGoogleDriveAuth } from "@/lib/google/drive";

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
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-semibold text-foreground" title={value}>
        {value}
      </dd>
    </div>
  );
}

const linkChip =
  "inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground transition-premium hover:border-border-strong hover:bg-accent";

const warningChip = cn(
  "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold",
  tones.amber.badge
);

function ExternalHref({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkChip}>
      {label}
      <ExternalLink className="size-3 text-muted-foreground" />
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

  const [clientAssets, demandRefs, exportFiles, driveAuth] = await Promise.all([
    demand.client_id && user
      ? getClientVisualAssets(demand.client_id, user.id)
      : Promise.resolve(null),
    getDemandReferenceImages(id),
    getDemandExportFiles(id),
    getGoogleDriveAuth(),
  ]);

  const title =
    demand.briefing.titulo ||
    displayExternalClientName(demand.client_name_external) ||
    "Demanda";
  const instagram = demand.briefing.instagramCliente.trim();
  const driveFolder = resolveDemandDriveFolder(
    collectDemandDriveUrls({
      storedUrl: demand.drive_folder_url,
      briefing: demand.briefing,
      artes: demand.artes,
    })
  );
  const driveFolderUrl = demand.drive_folder_url || driveFolder.url;
  const driveFolderId = demand.drive_folder_id || driveFolder.id;
  const missingMateriaisEditados = isMateriaisEditadosMissing(demand.briefing);

  return (
    <DashboardPage
      title={title}
      backHref="/demands"
      backLabel="Demandas"
      headerAction={
        <>
          <Link
            href={`/demands/${id}/curation`}
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <Images className="size-4" />
            Curadoria
          </Link>
          <Link
            href={`/demands/${id}/prompts`}
            className={cn(buttonVariants({ variant: "default" }), "gap-2")}
          >
            <Sparkles className="size-4" />
            Prompts com IA
          </Link>
        </>
      }
    >
      <MarkDemandReadOnMount demandId={id} isNew={demand.is_new} />
      <div className={layout.sectionGap}>
        {/* Status, cliente, tempo + entrega */}
        <Surface className="overflow-visible">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <DemandDetailStatusBar
                demandId={demand.id}
                status={demand.status}
                allowedStatuses={demand.status_permitidos}
                startedAt={demand.started_at}
                elapsedSeconds={demand.elapsed_seconds}
                currentClientId={demand.client_id}
                currentClientName={demand.client_name}
                externalClientName={demand.client_name_external}
                clientNotFound={demand.client_not_found}
                clients={clients}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!demand.client_not_found && (
                <MagnificSpaceButton
                  demandId={demand.id}
                  status={demand.magnific_space_status}
                  spaceUrl={demand.magnific_space_url}
                  errorMessage={demand.magnific_space_error}
                />
              )}
              <DemandDeliverDialog
                demandId={demand.id}
                artes={demand.artes}
                demandTitle={demand.briefing.titulo}
                demandTipo={demand.tipo ?? demand.briefing.tipo}
                clientName={
                  demand.client_name ||
                  displayExternalClientName(demand.client_name_external) ||
                  demand.client_name_external
                }
                clientSlug={demand.client_slug}
                driveFolderUrl={driveFolderUrl}
                driveFolderId={driveFolderId}
                exportStatus={demand.export_status ?? null}
                exportError={demand.export_error ?? null}
                initialFiles={exportFiles}
                driveAuth={driveAuth}
              />
            </div>
          </div>

          {/* Detalhes do briefing */}
          <div className="border-t border-border px-4 py-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
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
            </dl>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {instagram ? (
                <a
                  href={instagramHref(instagram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkChip}
                >
                  Instagram
                  <ExternalLink className="size-3 text-muted-foreground" />
                </a>
              ) : null}
              {missingMateriaisEditados ? (
                <span
                  title="A demanda não trouxe o link de Materiais Editados — confira no WAR"
                  className={warningChip}
                >
                  <AlertTriangle className="size-3" />
                  Sem link de Materiais Editados
                </span>
              ) : (
                <ExternalHref
                  href={demand.briefing.materiaisEditados}
                  label="Materiais"
                />
              )}
              <ExternalHref
                href={driveFolderUrl || demand.briefing.driveMateriais}
                label="Drive"
              />
              {driveFolderUrl && !driveFolderId ? (
                <span className={warningChip}>
                  <AlertTriangle className="size-3" />
                  Link do Drive sem pasta válida
                </span>
              ) : null}
            </div>
          </div>
        </Surface>

        <section className="space-y-4">
          <SectionHeader
            icon={FileText}
            tone="cyan"
            title={`Briefing das artes (${demand.artes.length})`}
            description="Headlines e CTAs no formato 3:4"
          />
          <DemandArteFeed demandId={id} artes={demand.artes} />
        </section>

        <Surface padding="md" className="space-y-6">
          <SectionHeader
            icon={ImageIcon}
            tone="violet"
            title="Logo e referências"
            description="Materiais do cliente e referências específicas desta demanda"
          />
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
        </Surface>

        <CreativeBriefPanel
          demandId={id}
          hasClient={Boolean(demand.client_id)}
        />
      </div>
    </DashboardPage>
  );
}
