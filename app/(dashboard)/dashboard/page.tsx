import Link from "next/link";
import { Brain, Sparkles, Users, Workflow } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { ClientCard } from "@/components/clients/client-card";
import { CreateClientForm } from "@/components/clients/create-client-form";
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
import { getClientsForUser, getDashboardStats } from "@/services/clients";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [stats, clients] = await Promise.all([
    getDashboardStats(user.id),
    getClientsForUser(user.id),
  ]);

  const recentClients = clients.slice(0, 4);

  return (
    <DashboardShell
      title="Dashboard"
      description="Visão geral dos clientes e Creative Brains da agência"
    >
      <div className={layout.sectionGap}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total de clientes"
            value={stats.totalClients}
            icon={Users}
            className="stagger-1 animate-in-soft"
          />
          <StatCard
            title="Em onboarding"
            value={stats.onboardingClients}
            icon={Workflow}
            className="stagger-2 animate-in-soft"
          />
          <StatCard
            title="Creative Brains"
            value={stats.creativeBrains}
            icon={Brain}
            className="stagger-3 animate-in-soft"
          />
          <StatCard
            title="Aprovados"
            value={stats.approvedBrains}
            description="Brand DNA revisado"
            icon={Sparkles}
            className="stagger-4 animate-in-soft"
          />
        </div>

        <Surface variant="elevated">
          <SurfaceHeader>
            <SurfaceTitle>Novo cliente</SurfaceTitle>
            <SurfaceDescription>
              Cadastre um cliente para iniciar onboarding e geração de Brand DNA
            </SurfaceDescription>
          </SurfaceHeader>
          <SurfaceContent>
            <CreateClientForm />
          </SurfaceContent>
        </Surface>

        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium tracking-heading">
                Clientes recentes
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Últimas marcas adicionadas ao workspace
              </p>
            </div>
            <Link
              href="/clients"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "inline-flex shrink-0"
              )}
            >
              Ver todos
            </Link>
          </div>

          {recentClients.length === 0 ? (
            <Surface variant="dashed" padding="lg">
              <div className="flex flex-col items-center text-center">
                <Users
                  className="mb-4 size-8 text-muted-foreground/50"
                  strokeWidth={1.25}
                />
                <p className="text-sm font-medium text-foreground">
                  Nenhum cliente ainda
                </p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Crie seu primeiro cliente para começar o fluxo de onboarding
                  criativo.
                </p>
              </div>
            </Surface>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {recentClients.map((client) => (
                <ClientCard key={client.id} client={client} />
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
