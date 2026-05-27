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
import type { Client } from "@/types";

const statusLabels: Record<Client["status"], string> = {
  draft: "Rascunho",
  onboarding: "Onboarding",
  active: "Ativo",
  archived: "Arquivado",
};

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

  const [references, creativeBrain] = await Promise.all([
    getClientReferences(id),
    getLatestCreativeBrain(id),
  ]);

  return (
    <DashboardShell
      title={client.name}
      description={`/${client.slug}`}
    >
      <div className={layout.sectionGap}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{statusLabels[client.status]}</Badge>
          {creativeBrain && (
            <Badge variant="secondary">
              Creative Brain v{creativeBrain.version}
            </Badge>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkflowModuleCard
            title="Onboarding"
            description="Formulário criativo e contexto da marca"
            icon={ClipboardList}
            actionLabel="Em breve"
          />
          <WorkflowModuleCard
            title="Referências"
            description={`${references.length} imagem(ns) enviada(s)`}
            icon={ImageIcon}
            actionLabel="Upload em breve"
          />
          <WorkflowModuleCard
            title="Creative Brain"
            description={
              creativeBrain
                ? `Status: ${creativeBrain.status}`
                : "Brand DNA ainda não gerado"
            }
            icon={Brain}
            actionLabel="Gerar com IA"
          />
          <WorkflowModuleCard
            title="Criativos"
            description="Estrutura preparada para geração futura"
            icon={Sparkles}
            actionLabel="Fase 2"
          />
        </div>

        {references.length > 0 && (
          <section className="space-y-5">
            <div>
              <h2 className="text-lg font-medium tracking-heading">
                Referências visuais
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Inspirações e assets de referência do cliente
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {references.map((ref) => (
                <div
                  key={ref.id}
                  className="group aspect-square overflow-hidden rounded-lg border border-border/50 bg-card/30 transition-premium hover:border-border/70"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ref.public_url}
                    alt={ref.file_name}
                    className="size-full object-cover opacity-90 transition-premium group-hover:opacity-100 group-hover:scale-[1.02]"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

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
