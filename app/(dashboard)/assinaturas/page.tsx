import { DashboardPage } from "@/components/layout/dashboard-page";
import { SubscriptionsSummary } from "@/components/subscriptions/subscriptions-summary";
import { SubscriptionsTable } from "@/components/subscriptions/subscriptions-table";
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
      <div className="space-y-6">
        <SubscriptionsSummary summary={summary} />
        <SubscriptionsTable subscriptions={subscriptions} clients={clients} />
      </div>
    </DashboardPage>
  );
}
