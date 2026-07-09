"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  ClipboardList,
  Globe,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut } from "@/actions/auth";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useNewDemandsCount } from "@/components/demands/new-demands-count-provider";
import { layout } from "@/lib/design/tokens";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/demands", label: "Demandas", icon: ClipboardList },
  { href: "/web-demands", label: "Demandas Web", icon: Globe },
];

type AppSidebarProps = {
  userName?: string | null;
  userEmail?: string | null;
};

export function AppSidebar({ userName, userEmail }: AppSidebarProps) {
  const pathname = usePathname();
  const { count: newDemandsCount } = useNewDemandsCount();

  return (
    <aside
      className={cn(
        layout.sidebarWidth,
        "flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar backdrop-blur-2xl"
      )}
    >
      {/* Logo */}
      <div className="flex h-[var(--header-height)] items-center gap-3 px-5 border-b border-sidebar-border/60">
        <div className="relative flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/6 dark:bg-white/5">
          <Brain className="size-4 text-foreground/90" strokeWidth={1.75} />
          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-positive animate-glow-pulse dark:shadow-[0_0_6px_var(--positive)]" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">
            Creative OS
          </p>
          <p className="truncate text-[0.6rem] font-medium tracking-[0.12em] uppercase text-muted-foreground/70">
            Operating System
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 pt-4">
        <p className="mb-2.5 px-3 text-[0.5625rem] font-semibold tracking-[0.14em] text-muted-foreground/50 uppercase">
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
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.8125rem] font-medium transition-premium",
                isActive
                  ? "nav-active-indicator bg-sidebar-accent pl-4 text-sidebar-accent-foreground dark:bg-white/7"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground dark:hover:bg-white/5"
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  isActive
                    ? "text-positive dark:drop-shadow-[0_0_6px_var(--positive)]"
                    : "text-muted-foreground"
                )}
                strokeWidth={isActive ? 2 : 1.75}
              />
              {item.label}
              {item.href === "/demands" && newDemandsCount > 0 && (
                <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-positive text-[0.6rem] font-bold text-positive-foreground dark:shadow-[0_0_8px_var(--positive)]">
                  {newDemandsCount > 99 ? "99+" : newDemandsCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto space-y-3 border-t border-sidebar-border/60 p-4">
        <div className="rounded-xl border border-white/7 bg-white/4 px-3.5 py-3 dark:bg-white/3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/8 text-[0.5625rem] font-semibold text-foreground/80 uppercase">
              {userName?.charAt(0) ?? "U"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[0.8125rem] font-medium text-foreground/90">
                {userName ?? "Usuário"}
              </p>
              <p className="truncate text-[0.6875rem] text-muted-foreground/70">
                {userEmail}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <ThemeToggle compact />
          <form action={signOut} className="flex-1">
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
      </div>
    </aside>
  );
}
