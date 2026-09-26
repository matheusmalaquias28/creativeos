import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandMenuProvider } from "@/components/layout/command-menu";
import { DemandsRealtimeListener } from "@/components/demands/demands-realtime-listener";
import { NewDemandsCountProvider } from "@/components/demands/new-demands-count-provider";
import { getAuthUser } from "@/lib/auth/session";
import { getNewDemandsCount } from "@/services/demands";
import { getCurrentUserProfile } from "@/services/users";
import { NavAccessProvider } from "@/components/layout/nav-access";
import { canAccessPath, parseRole } from "@/lib/auth/permissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const role = parseRole(user.app_metadata?.role);
  const seesDemands = canAccessPath(role, "/demands");

  const [profile, newDemandsCount] = await Promise.all([
    getCurrentUserProfile(),
    seesDemands ? getNewDemandsCount() : Promise.resolve(0),
  ]);

  return (
    <NavAccessProvider role={role}>
    <NewDemandsCountProvider initialCount={newDemandsCount}>
      <CommandMenuProvider>
        <div className="flex min-h-screen flex-col lg:flex-row">
          {seesDemands && <DemandsRealtimeListener />}
          <AppSidebar
            userName={profile?.full_name}
            userEmail={profile?.email ?? user.email}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </CommandMenuProvider>
    </NewDemandsCountProvider>
    </NavAccessProvider>
  );
}
