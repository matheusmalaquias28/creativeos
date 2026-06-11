"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, ClipboardList, LayoutDashboard, LogOut, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut } from "@/actions/auth";
import { layout } from "@/lib/design/tokens";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/demands", label: "Demandas", icon: ClipboardList },
];

type AppSidebarProps = {
  userName?: string | null;
  userEmail?: string | null;
  newDemandsCount?: number;
};

export function AppSidebar({ userName, userEmail, newDemandsCount = 0 }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        layout.sidebarWidth,
        "flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl"
      )}
    >
      <div className="flex h-[var(--header-height)] items-center gap-3 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg border border-border/50 bg-surface-elevated">
          <Brain className="size-4 text-foreground/90" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium tracking-heading text-foreground">
            Creative OS
          </p>
          <p className="truncate text-[0.6875rem] text-muted-foreground">
            Operating System
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 pt-2">
        <p className="mb-2 px-3 text-[0.625rem] font-medium tracking-widest text-muted-foreground/70 uppercase">
          Workspace
        </p>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.8125rem] font-medium transition-premium",
                isActive
                  ? "nav-active-indicator bg-sidebar-accent/80 pl-4 text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
                strokeWidth={1.75}
              />
              {item.label}
              {item.href === "/demands" && newDemandsCount > 0 && (
                <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-indigo-500 text-[0.6rem] font-bold text-white">
                  {newDemandsCount > 99 ? "99+" : newDemandsCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4 border-t border-sidebar-border/60 p-4">
        <div className="rounded-lg border border-border/40 bg-card/30 px-3.5 py-3">
          <p className="truncate text-sm font-medium text-foreground/90">
            {userName ?? "Usuário"}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {userEmail}
          </p>
        </div>

        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-4" strokeWidth={1.75} />
            Sair
          </Button>
        </form>
      </div>
    </aside>
  );
}
