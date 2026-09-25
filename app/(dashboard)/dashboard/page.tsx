import Link from "next/link";
import { ArrowUpRight, BarChart3, Brain, Sparkles, Users, Workflow } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { SectionHeader } from "@/components/layout/section-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DashboardDemandsAnalyticsLoader } from "@/components/dashboard/dashboard-demands-analytics-loader";
import { ClientCard } from "@/components/clients/client-card";
import { NewClientDialog } from "@/components/clients/new-client-dialog";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { layout } from "@/lib/design/tokens";
import { getAuthUser } from "@/lib/auth/session";
import { getClientsForUser, getDashboardStats } from "@/services/clients";
import { getDashboardAnalytics } from "@/services/demands";
import { getCurrentUserProfile } from "@/services/users";

function greeting(date: Date) {
  const hour = Number(
    date.toLocaleString("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" })
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function DashboardPageRoute() {
  const user = await getAuthUser();
  if (!user) return null;

  const [stats, clients, analytics, profile] = await Promise.all([
    getDashboardStats(user.id),
    getClientsForUser(user.id),
    getDashboardAnalytics(),
    getCurrentUserProfile(),
  ]);

  const recentClients = clients
    .filter((client) => client.status !== "archived")
    .slice(0, 6);

  const now = new Date();
  const firstName = profile?.full_name?.split(" ")[0];
  const todayRaw = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  return (
    <DashboardPage
      title={firstName ? `${greeting(now)}, ${firstName}` : greeting(now)}
      eyebrow={
        <span className="inline-flex items-center gap-2 font-medium">
          <span className="size-1.5 rounded-full bg-highlight shadow-[0_0_8px_var(--highlight)]" />
          {today}
        </span>
      }
      description="O pulso da operação criativa: produção, fila de demandas e carteira de clientes."
      headerAction={
        <>
          <Link
            href="/demands"
            className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}
          >
            Ver demandas
          </Link>
          <NewClientDialog />
        </>
      }
    >
      <div className={layout.sectionGap}>
        <section className="space-y-4">
          <SectionHeader
            title="Produção"
            description="Demandas e artes do time de criação"
            icon={BarChart3}
            tone="violet"
          />
          <DashboardDemandsAnalyticsLoader data={analytics} />
        </section>

        <section className="space-y-4">
          <SectionHeader
            title="Carteira de clientes"
            description="Onboarding e Creative Brains da agência"
            icon={Users}
            tone="orange"
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total de clientes"
              value={stats.totalClients}
              icon={Users}
              tone="orange"
              className="stagger-1 animate-in-soft"
            />
            <StatCard
              title="Em onboarding"
              value={stats.onboardingClients}
              icon={Workflow}
              tone="blue"
              className="stagger-2 animate-in-soft"
            />
            <StatCard
              title="Creative Brains"
              value={stats.creativeBrains}
              icon={Brain}
              tone="violet"
              className="stagger-3 animate-in-soft"
            />
            <StatCard
              title="Aprovados"
              value={stats.approvedBrains}
              description="Brand DNA revisado"
              icon={Sparkles}
              tone="green"
              className="stagger-4 animate-in-soft"
            />
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            title="Clientes recentes"
            description="Últimas marcas adicionadas ao workspace"
            action={
              <Link
                href="/clients"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "inline-flex text-foreground"
                )}
              >
                Ver todos
                <ArrowUpRight className="size-3.5" />
              </Link>
            }
          />

          {recentClients.length === 0 ? (
            <EmptyState
              icon={Users}
              tone="orange"
              title="Nenhum cliente ainda"
              description="Crie seu primeiro cliente para começar o fluxo de onboarding criativo."
              action={<NewClientDialog label="Criar primeiro cliente" />}
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {recentClients.map((client) => (
                <ClientCard key={client.id} client={client} />
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardPage>
  );
}
