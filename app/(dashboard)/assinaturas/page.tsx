import { Receipt } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { SectionHeader } from "@/components/layout/section-header";
import { SubscriptionsSummary } from "@/components/subscriptions/subscriptions-summary";
import { SubscriptionsTable } from "@/components/subscriptions/subscriptions-table";
import { layout } from "@/lib/design/tokens";
import {
  getSubscriptionsForUser,
  getSubscriptionsDashboardSummary,
} from "@/services/subscriptions";
import { getClientOptionsForCurrentUser } from "@/services/clients";

export default async function AssinaturasPage() {
  const [subscriptions, summary, clients] = await Promise.all([
    getSubscriptionsForUser(),
    getSubscriptionsDashboardSummary(),
    getClientOptionsForCurrentUser(),
  ]);

  return (
    <DashboardPage
      title="Assinaturas"
      description="Assinaturas de hospedagem dos clientes, sincronizadas da Hubla"
    >
      <div className={layout.sectionGap}>
        <SubscriptionsSummary summary={summary} />

        <section className="space-y-4">
          <SectionHeader
            title="Todas as assinaturas"
            description="Vincule cada assinatura a um cliente e defina o vendedor responsável"
            icon={Receipt}
            tone="cyan"
          />
          <SubscriptionsTable subscriptions={subscriptions} clients={clients} />
        </section>
      </div>
    </DashboardPage>
  );
}
