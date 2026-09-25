import { DashboardPage } from "@/components/layout/dashboard-page";
import { ClientList } from "@/components/clients/client-list";
import { NewClientDialog } from "@/components/clients/new-client-dialog";
import { getAuthUser } from "@/lib/auth/session";
import { getClientsForUser } from "@/services/clients";

export default async function ClientsPage() {
  const user = await getAuthUser();
  if (!user) return null;

  const clients = await getClientsForUser(user.id);

  return (
    <DashboardPage
      title="Clientes"
      description="Gerencie marcas, onboarding e Creative Brains"
      headerAction={<NewClientDialog />}
    >
      <ClientList clients={clients} />
    </DashboardPage>
  );
}
