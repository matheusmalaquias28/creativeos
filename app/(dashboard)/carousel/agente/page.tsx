import { DashboardPage } from "@/components/layout/dashboard-page";
import { AgentRunsBoard } from "@/components/carousel-agent/agent-runs-board";
import { ResetUsageButton } from "@/components/carousel-agent/reset-usage-button";
import { layout } from "@/lib/design/tokens";
import { isAdminRole } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { listRuns } from "@/lib/carousel-agent/runs";
import { dailyImageLimit, imagesUsedLast24h, maxActiveRuns } from "@/lib/carousel-agent/limits";
import { getCurrentUserProfile } from "@/services/users";

export const metadata = {
  title: "Agente de Carrossel",
};

/** Teto de gasto: imagens do GPT Image nas últimas 24h (o tweet não conta). */
async function UsageLine() {
  const [used, limit, active] = [await imagesUsedLast24h(createAdminClient()), dailyImageLimit(), maxActiveRuns()];
  const pct = limit > 0 ? used / limit : 1;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="text-xs text-muted-foreground">
        Imagens geradas nas últimas 24h:{" "}
        <span className={pct >= 1 ? "font-semibold text-tone-red" : pct >= 0.8 ? "font-semibold text-tone-amber" : "font-semibold text-foreground"}>
          {used} de {limit}
        </span>{" "}
        · até {active} pedido{active > 1 ? "s" : ""} gerando ao mesmo tempo · cada card é gerado uma vez (refazer é manual)
      </p>
      <ResetUsageButton used={used} limit={limit} />
    </div>
  );
}

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
          <>
            <UsageLine />
            <AgentRunsBoard initialRuns={await listRuns(createAdminClient())} />
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-border-strong bg-surface p-4 text-sm text-muted-foreground">
            Só administradores aprovam os carrosséis do agente.
          </p>
        )}
      </div>
    </DashboardPage>
  );
}
