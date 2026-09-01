"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Globe,
  Images,
  LayoutDashboard,
  Layers,
  LogOut,
  Wand2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut } from "@/actions/auth";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useNewDemandsCount } from "@/components/demands/new-demands-count-provider";

const STORAGE_KEY = "sidebar-collapsed";

type NavChild = { href: string; label: string };
type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  children?: NavChild[];
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/demands", label: "Demandas", icon: ClipboardList },
  { href: "/web-demands", label: "Demandas Web", icon: Globe },
  {
    href: "/carousel",
    label: "Carrosséis",
    icon: Layers,
    children: [
      { href: "/carousel", label: "Todos os carrosséis" },
      { href: "/carousel/perfis", label: "Perfis" },
    ],
  },
  { href: "/gerador", label: "Gerador", icon: Wand2 },
  { href: "/galeria", label: "Galeria", icon: Images },
];

type AppSidebarProps = {
  userName?: string | null;
  userEmail?: string | null;
};

export function AppSidebar({ userName, userEmail }: AppSidebarProps) {
  const pathname = usePathname();
  const { count: newDemandsCount } = useNewDemandsCount();
  const [collapsed, setCollapsed] = useState(false);

  // Restaura a preferência salva (evita mismatch de hidratação lendo só no client).
  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "relative flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar backdrop-blur-2xl transition-[width] duration-200 ease-out",
        collapsed ? "w-[4.5rem]" : "w-[15.5rem]"
      )}
    >
      {/* Toggle na borda */}
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
        className="absolute -right-3 top-9 z-30 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-muted-foreground shadow-sm transition-colors hover:text-foreground hover:border-positive/40"
      >
        {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
      </button>

      {/* Logo */}
      <div
        className={cn(
          "flex h-[var(--header-height)] items-center border-b border-sidebar-border/60",
          collapsed ? "justify-center px-0" : "gap-3 px-5"
        )}
      >
        <div className="relative flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/6 dark:bg-white/5">
          <Brain className="size-4 text-foreground/90" strokeWidth={1.75} />
          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-positive animate-glow-pulse dark:shadow-[0_0_6px_var(--positive)]" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              Creative OS
            </p>
            <p className="truncate text-[0.6rem] font-medium tracking-[0.12em] uppercase text-muted-foreground/70">
              Operating System
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 pt-4">
        {!collapsed && (
          <p className="mb-2.5 px-3 text-[0.5625rem] font-semibold tracking-[0.14em] text-muted-foreground/50 uppercase">
            Workspace
          </p>
        )}
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const showChildren = !collapsed && !!item.children && isActive;
          const hasBadge = item.href === "/demands" && newDemandsCount > 0;

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "relative flex items-center rounded-xl text-[0.8125rem] font-medium transition-premium",
                  collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
                  isActive
                    ? cn(
                        "nav-active-indicator bg-sidebar-accent text-sidebar-accent-foreground dark:bg-white/7",
                        !collapsed && "pl-4"
                      )
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground dark:hover:bg-white/5"
                )}
              >
                <span className="relative flex shrink-0 items-center justify-center">
                  <Icon
                    className={cn(
                      "size-4",
                      isActive
                        ? "text-positive dark:drop-shadow-[0_0_6px_var(--positive)]"
                        : "text-muted-foreground"
                    )}
                    strokeWidth={isActive ? 2 : 1.75}
                  />
                  {/* Badge de demandas vira um ponto quando recolhido */}
                  {hasBadge && collapsed && (
                    <span className="absolute -right-1 -top-1 size-2 rounded-full bg-positive dark:shadow-[0_0_6px_var(--positive)]" />
                  )}
                </span>
                {!collapsed && (
                  <>
                    {item.label}
                    {hasBadge && (
                      <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-positive text-[0.6rem] font-bold text-positive-foreground dark:shadow-[0_0_8px_var(--positive)]">
                        {newDemandsCount > 99 ? "99+" : newDemandsCount}
                      </span>
                    )}
                  </>
                )}
              </Link>

              {showChildren && (
                <div className="mt-0.5 mb-1 ml-[1.35rem] space-y-0.5 border-l border-sidebar-border/70 pl-3">
                  {item.children!.map((child) => {
                    const childActive =
                      child.href === "/carousel"
                        ? pathname === "/carousel" ||
                          (pathname.startsWith("/carousel/") &&
                            !pathname.startsWith("/carousel/perfis"))
                        : pathname === child.href ||
                          pathname.startsWith(`${child.href}/`);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "flex items-center rounded-lg px-3 py-1.5 text-[0.75rem] font-medium transition-premium",
                          childActive
                            ? "text-foreground"
                            : "text-muted-foreground/70 hover:text-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "mr-2 size-1.5 rounded-full transition-colors",
                            childActive ? "bg-positive" : "bg-muted-foreground/30"
                          )}
                        />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "mt-auto border-t border-sidebar-border/60",
          collapsed ? "space-y-2 p-3" : "space-y-3 p-4"
        )}
      >
        {collapsed ? (
          <div
            className="mx-auto flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/8 text-[0.6875rem] font-semibold text-foreground/80 uppercase"
            title={userName ?? userEmail ?? "Usuário"}
          >
            {userName?.charAt(0) ?? "U"}
          </div>
        ) : (
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
        )}

        <div
          className={cn(
            "flex items-center gap-2",
            collapsed ? "flex-col" : "justify-between"
          )}
        >
          <ThemeToggle compact />
          <form action={signOut} className={collapsed ? "w-full" : "flex-1"}>
            <Button
              type="submit"
              variant="ghost"
              size={collapsed ? "icon-sm" : "sm"}
              title={collapsed ? "Sair" : undefined}
              className={cn(
                "text-muted-foreground hover:text-foreground",
                collapsed ? "mx-auto" : "w-full justify-start gap-2"
              )}
            >
              <LogOut className="size-4" strokeWidth={1.75} />
              {!collapsed && "Sair"}
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}
