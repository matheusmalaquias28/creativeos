import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DemandsRealtimeListener } from "@/components/demands/demands-realtime-listener";
import { NewDemandsCountProvider } from "@/components/demands/new-demands-count-provider";
import { getAuthUser } from "@/lib/auth/session";
import { getNewDemandsCount } from "@/services/demands";
import { getCurrentUserProfile } from "@/services/users";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const [profile, newDemandsCount] = await Promise.all([
    getCurrentUserProfile(),
    getNewDemandsCount(),
  ]);

  return (
    <NewDemandsCountProvider initialCount={newDemandsCount}>
      <div className="flex min-h-screen">
        <DemandsRealtimeListener />
        <AppSidebar
          userName={profile?.full_name}
          userEmail={profile?.email ?? user.email}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </NewDemandsCountProvider>
  );
}
