import { AppSidebar } from "@/components/layout/app-sidebar";
import { PageHeader } from "@/components/layout/page-header";
import { DemandsRealtimeListener } from "@/components/demands/demands-realtime-listener";
import { getCurrentUserProfile } from "@/services/users";
import { getNewDemandsCount } from "@/services/demands";
import { layout } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

export async function DashboardShell({
  children,
  title,
  description,
  headerAction,
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
  headerAction?: React.ReactNode;
}) {
  const [profile, newDemandsCount] = await Promise.all([
    getCurrentUserProfile(),
    getNewDemandsCount(),
  ]);

  return (
    <div className="flex min-h-screen">
      <DemandsRealtimeListener />
      <AppSidebar
        userName={profile?.full_name}
        userEmail={profile?.email}
        newDemandsCount={newDemandsCount}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {title && (
          <PageHeader
            title={title}
            description={description}
            action={headerAction}
          />
        )}
        <main
          className={cn(
            "flex-1 animate-in-soft",
            layout.pageX,
            layout.pageY,
            layout.contentMax,
            "w-full"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
