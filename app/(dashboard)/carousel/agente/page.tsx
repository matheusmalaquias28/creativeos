import { DashboardPage } from "@/components/layout/dashboard-page";
import { AgentRunsBoard } from "@/components/carousel-agent/agent-runs-board";
import { layout } from "@/lib/design/tokens";
import { isAdminRole } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { listRuns } from "@/lib/carousel-agent/runs";
import { getCurrentUserProfile } from "@/services/users";

export const metadata = {
  title: "Agente de Carrossel",
};

export default async function CarouselAgentPage() {
  const user = await getCurrentUserProfile();
  const admin = user && isAdminRole(user.role);

  return (
    <DashboardPage
      title="Agente de Carrossel"
      description="Carrosséis, artes e carrosséis tweet que o agente prepara, com legenda e hashtags. Nada vai para o Instagram sem a sua aprovação."
    >
      <div className={layout.sectionGap}>
        {admin ? (
          <AgentRunsBoard initialRuns={await listRuns(createAdminClient())} />
        ) : (
          <p className="rounded-xl border border-dashed border-border-strong bg-surface p-4 text-sm text-muted-foreground">
            Só administradores aprovam os carrosséis do agente.
          </p>
        )}
      </div>
    </DashboardPage>
  );
}
