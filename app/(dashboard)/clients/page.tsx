import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ClientCard } from "@/components/clients/client-card";
import { CreateClientForm } from "@/components/clients/create-client-form";
import {
  Surface,
  SurfaceContent,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/ui/surface";
import { layout } from "@/lib/design/tokens";
import { createClient } from "@/lib/supabase/server";
import { getClientsForUser } from "@/services/clients";

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const clients = await getClientsForUser(user.id);

  return (
    <DashboardShell
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

        {clients.length === 0 ? (
          <Surface variant="dashed" padding="lg">
            <p className="text-center text-sm text-muted-foreground">
              Nenhum cliente cadastrado.
            </p>
          </Surface>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
