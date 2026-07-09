import { DashboardPage } from "@/components/layout/dashboard-page";
import { ClientList } from "@/components/clients/client-list";
import { CreateClientForm } from "@/components/clients/create-client-form";
import {
  Surface,
  SurfaceContent,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/ui/surface";
import { layout } from "@/lib/design/tokens";
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
    >
      <div className={layout.sectionGap}>
        <Surface variant="elevated">
          <SurfaceHeader>
            <SurfaceTitle>Adicionar cliente</SurfaceTitle>
            <SurfaceDescription>
              Registro manual ou via automação futura
            </SurfaceDescription>
          </SurfaceHeader>
          <SurfaceContent>
            <CreateClientForm />
          </SurfaceContent>
        </Surface>

        <ClientList clients={clients} />
      </div>
    </DashboardPage>
  );
}
