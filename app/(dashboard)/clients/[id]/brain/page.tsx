import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { BrainViewer } from "@/components/creative-brain/brain-viewer";
import { BrainActions } from "@/components/creative-brain/brain-actions";
import { GenerateBrainButton } from "@/components/creative-brain/generate-brain-button";
import { Badge } from "@/components/ui/badge";
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
import { createClient } from "@/lib/supabase/server";
import { getClientById, getLatestCreativeBrain } from "@/services/clients";
import {
  getOnboardingAnswers,
  parseOnboardingAnswers,
  isOnboardingComplete,
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

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ brain?: string }>;
};

export default async function BrainPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { brain: brainQuery } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const canGenerate = isOnboardingComplete(parseOnboardingAnswers(onboarding));
  const brain = !fetchedBrain && brainQuery
    ? await getLatestCreativeBrain(id)
    : fetchedBrain;

  return (
    <DashboardShell
      title="Creative Brain"
      description={`${client.name} · Brand DNA estruturado`}
    >
      <div className={layout.sectionGap}>
        {!brain ? (
          <Surface variant="dashed" padding="lg">
            <div className="flex flex-col items-start gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Nenhum Creative Brain gerado
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {canGenerate
                    ? "Gere o Brand DNA com base no onboarding e referências."
                    : "Complete o onboarding criativo antes de gerar."}
                </p>
              </div>
              <GenerateBrainButton
                clientId={id}
                disabled={!canGenerate}
              />
              {!canGenerate && (
                <Link
                  href={`/clients/${id}/onboarding`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Ir para onboarding
                </Link>
              )}
            </div>
          </Surface>
        ) : brain.status === "generating" ? (
          <>
            <BrainGeneratingPoll clientId={id} active />
            <Surface variant="elevated" padding="lg">
              <p className="text-sm font-medium text-foreground">
                Geração em andamento
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Tempo máximo de {timeoutSeconds} segundos. Esta página atualiza
                automaticamente; se passar do limite, o status mudará para
                falhou.
              </p>
            </Surface>
          </>
        ) : brain.status === "failed" ? (
          <Surface variant="elevated" padding="lg">
            <div className="flex flex-col items-start gap-4">
              <div>
                <p className="text-sm font-medium text-destructive">
                  Falha na geração
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
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
          </Surface>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">v{brain.version}</Badge>
              <Badge variant="secondary">
                {statusLabels[brain.status]}
              </Badge>
            </div>

            <BrainActions
              clientId={id}
              brainId={brain.id}
              status={brain.status}
              canGenerate={canGenerate}
            />

            <BrainViewer brandDna={brain.brand_dna} />
          </>
        )}

        {history.length > 1 && (
          <Surface>
            <SurfaceHeader>
              <SurfaceTitle>Histórico de versões</SurfaceTitle>
              <SurfaceDescription>
                Versões anteriores do Creative Brain deste cliente
              </SurfaceDescription>
            </SurfaceHeader>
            <SurfaceContent>
              <ul className="space-y-2">
                {history.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/clients/${id}/brain?brain=${item.id}`}
                      className={cn(
                        "flex items-center justify-between rounded-lg border border-border/40 px-4 py-3 text-sm transition-premium hover:bg-muted/30",
                        item.id === brain?.id && "border-border/70 bg-muted/20"
                      )}
                    >
                      <span>
                        Versão {item.version} · {statusLabels[item.status]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </SurfaceContent>
          </Surface>
        )}

        <Link
          href={`/clients/${id}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "inline-flex gap-2 text-muted-foreground"
          )}
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          Voltar ao cliente
        </Link>
      </div>
    </DashboardShell>
  );
}
