import { notFound } from "next/navigation";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { UsersManager } from "@/components/users/users-manager";
import { getSuperAdminId, listManagedUsers } from "@/services/users-admin";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const selfId = await getSuperAdminId();
  if (!selfId) notFound();

  const users = await listManagedUsers();

  return (
    <DashboardPage
      title="Usuários"
      description="Crie acessos com e-mail e senha e defina o que cada pessoa pode ver"
    >
      <UsersManager users={users} selfId={selfId} />
    </DashboardPage>
  );
}
