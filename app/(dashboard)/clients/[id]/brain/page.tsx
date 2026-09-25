import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Brain, History, Loader2 } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { SectionHeader } from "@/components/layout/section-header";
import { BrainViewer } from "@/components/creative-brain/brain-viewer";
import { BrainActions } from "@/components/creative-brain/brain-actions";
import { GenerateBrainButton } from "@/components/creative-brain/generate-brain-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { tones, type Tone } from "@/lib/design/tokens";
import { getAuthUser } from "@/lib/auth/session";
import { getClientById, getLatestCreativeBrain } from "@/services/clients";
import {
  getOnboardingAnswers,
  parseOnboardingAnswers,
  isClientBriefingComplete,
} from "@/services/onboarding";
import {
  expireStaleGeneratingBrains,
  getCreativeBrainById,
  getCreativeBrainHistory,
} from "@/services/creative-brain";
import { BrainGeneratingPoll } from "@/components/creative-brain/brain-generating-poll";
import { CREATIVE_BRAIN_GENERATION_TIMEOUT_SECONDS } from "@/lib/constants/creative-brain-generation";

const statusLabels = {
  generating: "Gerando",
  draft: "Rascunho",
  approved: "Aprovado",
  archived: "Arquivado",
  failed: "Falhou",
} as const;

const statusTones: Record<keyof typeof statusLabels, Tone> = {
  generating: "blue",
  draft: "amber",
  approved: "green",
  archived: "slate",
  failed: "red",
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ brain?: string }>;
};

export default async function BrainPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { brain: brainQuery } = await searchParams;
  const user = await getAuthUser();
  if (!user) return null;

  const client = await getClientById(id, user.id);
  if (!client) notFound();

  await expireStaleGeneratingBrains(id);

  const timeoutSeconds = CREATIVE_BRAIN_GENERATION_TIMEOUT_SECONDS;

  const [onboarding, fetchedBrain, history] = await Promise.all([
    getOnboardingAnswers(id),
    brainQuery ? getCreativeBrainById(brainQuery, id) : getLatestCreativeBrain(id),
    getCreativeBrainHistory(id),
  ]);

  const canGenerate = await isClientBriefingComplete(id);
  const brain = !fetchedBrain && brainQuery
    ? await getLatestCreativeBrain(id)
    : fetchedBrain;

  const brainReady =
    brain && brain.status !== "generating" && brain.status !== "failed";
  const showHistory = history.length > 1;

  return (
    <DashboardPage
      title="Creative Brain"
      description="Brand DNA estruturado — base para prompts, artes e direção criativa."
      backHref={`/clients/${id}`}
      backLabel={client.name}
      eyebrow={
        brain ? (
          <>
            <Badge variant={statusTones[brain.status]}>
              <span className={cn("size-1.5 rounded-full", tones[statusTones[brain.status]].dot)} />
              {statusLabels[brain.status]}
            </Badge>
            <span className="font-mono text-xs">v{brain.version}</span>
          </>
        ) : undefined
      }
      headerAction={
        brainReady && brain ? (
          <BrainActions
            clientId={id}
            brainId={brain.id}
            status={brain.status}
            canGenerate={canGenerate}
          />
        ) : undefined
      }
    >
      <div
        className={cn(
          "grid gap-8",
          showHistory && "xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start"
        )}
      >
        <div className="min-w-0">
          {!brain ? (
            <EmptyState
              icon={Brain}
              tone="violet"
              title="Nenhum Creative Brain gerado"
              description={
                canGenerate
                  ? "Gere o Brand DNA com base no onboarding e referências."
                  : "Complete o onboarding antes de gerar."
              }
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {!canGenerate && (
                    <Link
                      href={`/clients/${id}/onboarding`}
                      className={cn(buttonVariants({ variant: "outline" }))}
                    >
                      Ir para onboarding
                    </Link>
                  )}
                  <GenerateBrainButton clientId={id} disabled={!canGenerate} />
                </div>
              }
            />
          ) : brain.status === "generating" ? (
            <>
              <BrainGeneratingPoll clientId={id} active />
              <Surface padding="md">
                <div className="flex items-start gap-4">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      tones.blue.iconTile
                    )}
                  >
                    <Loader2 className="size-[1.125rem] animate-spin" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      Geração em andamento
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Tempo máximo de {timeoutSeconds} segundos. Esta página atualiza
                      automaticamente; se passar do limite, o status mudará para
                      falhou.
                    </p>
                  </div>
                </div>
              </Surface>
            </>
          ) : brain.status === "failed" ? (
            <Surface padding="md">
              <div className="flex flex-col items-start gap-4 sm:flex-row">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    tones.red.iconTile
                  )}
                >
                  <AlertTriangle className="size-[1.125rem]" strokeWidth={2} />
                </span>
                <div className="flex-1 space-y-4">
                  <div>
                    <p className="text-sm font-bold text-tone-red">
                      Falha na geração
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      A geração não foi concluída no tempo limite de{" "}
                      {timeoutSeconds} segundos ou ocorreu um erro na IA. Tente
                      novamente.
                    </p>
                  </div>
                  <GenerateBrainButton
                    clientId={id}
                    disabled={!canGenerate}
                    label="Tentar novamente"
                  />
                </div>
              </div>
            </Surface>
          ) : (
            <BrainViewer brandDna={brain.brand_dna} />
          )}
        </div>

        {showHistory && (
          <aside className="space-y-4 xl:sticky xl:top-6">
            <SectionHeader
              title="Histórico de versões"
              description="Versões anteriores deste cliente"
              icon={History}
              tone="slate"
            />
            <Surface className="p-1.5">
              <ul className="space-y-0.5">
                {history.map((item) => {
                  const active = item.id === brain?.id;
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/clients/${id}/brain?brain=${item.id}`}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-premium hover:bg-accent",
                          active && "bg-accent ring-1 ring-inset ring-border-strong"
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              tones[statusTones[item.status]].dot
                            )}
                          />
                          <span className="min-w-0 truncate">
                            <span className="font-semibold text-foreground">
                              Versão {item.version}
                            </span>
                            <span className="text-muted-foreground">
                              {" "}
                              · {statusLabels[item.status]}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Surface>
          </aside>
        )}
      </div>
    </DashboardPage>
  );
}
