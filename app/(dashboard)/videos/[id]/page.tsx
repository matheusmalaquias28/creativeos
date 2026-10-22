import { notFound } from "next/navigation";
import {
  Braces,
  Building2,
  ExternalLink,
  FileText,
  Link2,
  User,
  Video,
} from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { SectionHeader } from "@/components/layout/section-header";
import { Surface } from "@/components/ui/surface";
import { DemandTimer } from "@/components/demands/demand-timer";
import { VideoDemandStatusSelector } from "@/components/video-demands/video-demand-status-selector";
import { ArchiveVideoButton } from "@/components/video-demands/archive-video-button";
import { MarkVideoReadOnMount } from "@/components/video-demands/mark-video-read-on-mount";
import { layout, tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { displayExternalClientName } from "@/lib/demands/normalize-client-name";
import { getVideoDemandById } from "@/services/video-demands";

export const maxDuration = 120;

type PageProps = { params: Promise<{ id: string }> };

// ─── helpers de leitura do payload cru ───────────────────────────────────────

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function instagramHref(value: string): string {
  if (value.startsWith("http")) return value;
  return `https://instagram.com/${value.replace(/^@/, "")}`;
}

// ─── primitivas de UI ─────────────────────────────────────────────────────────

const linkChip =
  "inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground transition-premium hover:border-border-strong hover:bg-accent";

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

function LinkItem({ href, label }: { href: string; label: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkChip}>
      {label}
      <ExternalLink className="size-3 text-muted-foreground" />
    </a>
  );
}

export default async function VideoDemandDetailPage({ params }: PageProps) {
  const { id } = await params;
  const demand = await getVideoDemandById(id);
  if (!demand) notFound();

  const payload = rec(demand.raw_payload);
  const cliente = rec(payload.cliente);
  const briefing = demand.briefing;

  const clientLabel =
    demand.client_name ||
    displayExternalClientName(demand.client_name_external) ||
    demand.client_name_external ||
    "Pendente de cadastro";

  const title = briefing.titulo || clientLabel || "Demanda de vídeo";
  const instagram = briefing.instagramCliente.trim();
  const descricao = briefing.descricao || str(payload.briefingTexto);
  const prioridade = demand.prioridade || briefing.prioridade;
  const qty = briefing.quantidadeVideos;

  const solicitanteEmail = str(payload.solicitanteEmail);
  const solicitanteId = str(payload.solicitanteId);
  const updatedAt = str(payload.updatedAt);
  const statusChangedAt = str(payload.statusChangedAt);
  const callbackUrl = str(rec(payload.callback).url);
  const statusPermitidos = demand.status_permitidos ?? [];

  return (
    <DashboardPage title={title} backHref="/videos" backLabel="Vídeos">
      <MarkVideoReadOnMount demandId={id} isNew={demand.is_new} />

      <div className={layout.sectionGap}>
        {/* Status + ações + meta principal */}
        <Surface className="overflow-visible">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground">
                <Video className="size-3.5 text-tone-pink" />
                {clientLabel}
              </span>
              <VideoDemandStatusSelector
                demandId={demand.id}
                currentStatus={demand.status}
                allowedStatuses={statusPermitidos}
              />
              <DemandTimer
                status={demand.status}
                startedAt={demand.started_at}
                elapsedSeconds={demand.elapsed_seconds}
              />
            </div>
            {!demand.is_archived && <ArchiveVideoButton demandId={demand.id} />}
          </div>

          <div className="border-t border-border px-4 py-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
              <MetaItem label="Tipo" value="Vídeo" />
              <MetaItem label="Categoria" value={demand.categoria} />
              <MetaItem label="Prioridade" value={prioridade} />
              <MetaItem
                label="Quantidade de vídeos"
                value={qty != null ? String(qty) : null}
              />
              <MetaItem label="Squad" value={demand.squad} />
              <MetaItem label="Gestor" value={demand.gestor} />
              <MetaItem label="Editor / Webdesigner" value={demand.webdesigner} />
              <MetaItem label="Solicitante" value={demand.solicitante} />
              <MetaItem
                label="Criada"
                value={formatDate(demand.external_created_at ?? demand.created_at)}
              />
              <MetaItem label="Prazo" value={demand.due_date ? formatDate(demand.due_date) : null} />
              <MetaItem label="Atualizada (WAR)" value={updatedAt ? formatDate(updatedAt) : null} />
              <MetaItem
                label="Status alterado em"
                value={statusChangedAt ? formatDate(statusChangedAt) : null}
              />
            </dl>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {instagram && <LinkItem href={instagramHref(instagram)} label="Instagram" />}
              <LinkItem href={briefing.driveMateriais} label="Drive — Materiais" />
              <LinkItem href={briefing.driveEditados} label="Drive — Editados" />
            </div>
          </div>
        </Surface>

        {/* Briefing */}
        <section className="space-y-4">
          <SectionHeader
            icon={FileText}
            tone="cyan"
            title="Briefing"
            description="Descrição enviada pelo solicitante"
          />
          <Surface padding="md">
            {descricao ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {descricao}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Sem descrição no briefing.</p>
            )}
          </Surface>
        </section>

        {/* Dados do cliente (do payload) */}
        {Object.keys(cliente).length > 0 && (
          <section className="space-y-4">
            <SectionHeader
              icon={Building2}
              tone="orange"
              title="Cliente"
              description="Dados do cliente enviados no payload"
            />
            <Surface padding="md" className="space-y-4">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                <MetaItem label="Nome" value={str(cliente.name)} />
                <MetaItem label="Ramo" value={str(cliente.ramo)} />
                <MetaItem label="Foco" value={str(cliente.foco)} />
                <MetaItem label="Plataforma" value={str(cliente.plataforma)} />
                <MetaItem label="Account Manager" value={str(cliente.accountManager)} />
                <MetaItem label="Supervisor" value={str(cliente.supervisor)} />
                <MetaItem label="Responsável" value={str(cliente.responsavel)} />
                <MetaItem label="Telefone" value={str(cliente.telefone)} />
                <MetaItem label="E-mail" value={str(cliente.email)} />
              </dl>
              <div className="flex flex-wrap items-center gap-2">
                {str(cliente.instagram) && (
                  <LinkItem href={instagramHref(str(cliente.instagram))} label="Instagram" />
                )}
                {str(cliente.site) && <LinkItem href={str(cliente.site)} label="Site" />}
                {str(cliente.drive) && <LinkItem href={str(cliente.drive)} label="Drive do cliente" />}
              </div>
            </Surface>
          </section>
        )}

        {/* Solicitante + integração WAR */}
        <section className="space-y-4">
          <SectionHeader
            icon={User}
            tone="violet"
            title="Solicitante e integração"
            description="Quem pediu e a conexão com o WAR"
          />
          <Surface padding="md" className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
              <MetaItem label="Solicitante" value={demand.solicitante} />
              <MetaItem label="E-mail" value={solicitanteEmail} />
              <MetaItem label="ID do solicitante" value={solicitanteId} />
              <MetaItem label="ID externo (WAR)" value={demand.external_id} />
            </dl>

            {statusPermitidos.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Status permitidos</p>
                <div className="flex flex-wrap gap-1.5">
                  {statusPermitidos.map((status) => (
                    <span
                      key={status}
                      className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold",
                        status === demand.status ? tones.cyan.badge : "border-border bg-muted text-muted-foreground"
                      )}
                    >
                      {status}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {callbackUrl && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Link2 className="size-3.5 shrink-0" />
                <span className="truncate" title={callbackUrl}>
                  Callback de status → {callbackUrl}
                </span>
              </div>
            )}
          </Surface>
        </section>

        {/* Payload completo */}
        <section className="space-y-4">
          <SectionHeader
            icon={Braces}
            tone="slate"
            title="Payload completo"
            description="JSON cru recebido do webhook, para conferência"
          />
          <Surface padding="md">
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-foreground select-none">
                Ver JSON recebido
              </summary>
              <pre className="mt-3 max-h-[28rem] overflow-auto rounded-xl bg-muted p-4 text-xs leading-relaxed text-foreground">
                {JSON.stringify(demand.raw_payload, null, 2)}
              </pre>
            </details>
          </Surface>
        </section>
      </div>
    </DashboardPage>
  );
}
