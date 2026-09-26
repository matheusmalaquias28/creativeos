"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ArrowRight,
  ChevronsUpDown,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
} from "lucide-react";
import { useNavAccess } from "@/components/layout/nav-access";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/actions/auth";
import { useNewDemandsCount } from "@/components/demands/new-demands-count-provider";
import { BrandMark, BrandWordmark } from "@/components/layout/brand-mark";
import { useCommandMenu } from "@/components/layout/command-menu";
import {
  isNavChildActive,
  isNavItemActive,
} from "@/components/layout/nav-config";

const STORAGE_KEY = "sidebar-collapsed";

type AppSidebarProps = {
  userName?: string | null;
  userEmail?: string | null;
};

export function AppSidebar({ userName, userEmail }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { open: openCommand } = useCommandMenu();
  const { homeHref } = useNavAccess();

  // Restaura a preferência salva (evita mismatch de hidratação lendo só no client).
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* storage indisponível */
    }
  }, []);

  // Fecha o menu mobile ao trocar de rota.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* storage indisponível */
      }
      return next;
    });
  }

  return (
    <>
      {/* Top bar mobile */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-sidebar-border bg-sidebar/90 px-4 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          className="flex size-9 items-center justify-center rounded-xl text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <Menu className="size-5" strokeWidth={1.75} />
        </button>
        <Link href={homeHref} className="flex items-center gap-2.5">
          <BrandMark size="sm" />
          <span className="text-sm font-bold tracking-tight">Creative OS</span>
        </Link>
        <button
          type="button"
          onClick={openCommand}
          aria-label="Buscar"
          className="ml-auto flex size-9 items-center justify-center rounded-xl text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <Search className="size-[1.125rem]" strokeWidth={1.75} />
        </button>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[18rem] max-w-[85vw] gap-0 border-r border-sidebar-border bg-sidebar p-0 lg:hidden"
        >
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <SidebarBody
            collapsed={false}
            pathname={pathname}
            userName={userName}
            userEmail={userEmail}
            onNavigate={() => setMobileOpen(false)}
            onSearch={() => {
              setMobileOpen(false);
              openCommand();
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Sidebar desktop */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-[4.75rem]" : "w-[16.5rem]"
        )}
      >
        <SidebarBody
          collapsed={collapsed}
          pathname={pathname}
          userName={userName}
          userEmail={userEmail}
          onToggle={toggle}
          onSearch={openCommand}
        />
      </aside>
    </>
  );
}

type SidebarBodyProps = {
  collapsed: boolean;
  pathname: string;
  userName?: string | null;
  userEmail?: string | null;
  onNavigate?: () => void;
  onToggle?: () => void;
  onSearch: () => void;
};

function SidebarBody({
  collapsed,
  pathname,
  userName,
  userEmail,
  onNavigate,
  onToggle,
  onSearch,
}: SidebarBodyProps) {
  const { count: newDemandsCount } = useNewDemandsCount();
  const { sections, homeHref, can } = useNavAccess();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/mac|iphone|ipad/i.test(navigator.userAgent));
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Marca + recolher */}
      <div
        className={cn(
          "flex h-[4.5rem] shrink-0 items-center",
          collapsed ? "justify-center px-0" : "gap-3 px-5"
        )}
      >
        <Link
          href={homeHref}
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-3"
          title={collapsed ? "Creative OS" : undefined}
        >
          <BrandMark />
          {!collapsed && <BrandWordmark />}
        </Link>
        {onToggle && !collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Recolher menu"
            title="Recolher menu"
            className="ml-auto flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <PanelLeftClose className="size-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Busca / command menu */}
      <div className={cn("shrink-0 pb-2", collapsed ? "px-3" : "px-4")}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            {onToggle && (
              <button
                type="button"
                onClick={onToggle}
                aria-label="Expandir menu"
                title="Expandir menu"
                className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              >
                <PanelLeftOpen className="size-4" strokeWidth={1.75} />
              </button>
            )}
            <button
              type="button"
              onClick={onSearch}
              aria-label="Buscar"
              title="Buscar (Ctrl K)"
              className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Search className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSearch}
            className="group flex h-10 w-full items-center gap-2.5 rounded-xl border border-sidebar-border bg-background/60 px-3 text-left text-[0.8125rem] text-muted-foreground transition-premium hover:border-border-strong hover:text-foreground"
          >
            <Search className="size-4 shrink-0" strokeWidth={1.75} />
            <span className="flex-1 truncate">Buscar…</span>
            <kbd className="rounded-md border border-sidebar-border bg-sidebar-accent px-1.5 py-0.5 font-sans text-[0.625rem] font-semibold text-muted-foreground">
              {isMac ? "⌘" : "Ctrl"} K
            </kbd>
          </button>
        )}
      </div>

      {/* Navegação */}
      <nav className={cn("flex-1 overflow-y-auto pb-4", collapsed ? "px-3" : "px-4")}>
        {sections.map((section, sectionIndex) => (
          <div key={section.id} className={cn(sectionIndex > 0 && "mt-5")}>
            {collapsed ? (
              sectionIndex > 0 && <div className="mx-auto mb-3 h-px w-6 bg-sidebar-border" />
            ) : (
              <p className="mb-1.5 px-3 text-[0.6875rem] font-semibold tracking-[0.04em] text-muted-foreground/70">
                {section.label}
              </p>
            )}

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = isNavItemActive(pathname, item.href);
                const Icon = item.icon;
                const showChildren = !collapsed && !!item.children && isActive;
                const badge = item.href === "/demands" && newDemandsCount > 0 ? newDemandsCount : 0;

                return (
                  <div key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group/nav relative flex items-center rounded-xl text-[0.8125rem] font-semibold transition-premium",
                        collapsed ? "mx-auto size-10 justify-center" : "h-10 gap-3 px-3",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/18%),0_6px_16px_-8px_color-mix(in_oklch,var(--primary)_80%,transparent)]"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <span className="relative flex shrink-0 items-center justify-center">
                        <Icon
                          className={cn(
                            "size-[1.0625rem]",
                            isActive
                              ? "text-primary-foreground"
                              : "text-muted-foreground group-hover/nav:text-foreground"
                          )}
                          strokeWidth={isActive ? 2 : 1.75}
                        />
                        {badge > 0 && collapsed && (
                          <span className="absolute -top-1 -right-1 size-2 rounded-full bg-highlight ring-2 ring-sidebar" />
                        )}
                      </span>
                      {!collapsed && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {badge > 0 && (
                            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-highlight px-1.5 text-[0.625rem] font-bold text-highlight-foreground tabular-nums">
                              {badge > 99 ? "99+" : badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>

                    {showChildren && (
                      <div className="mt-1 mb-1 ml-[1.3rem] space-y-0.5 border-l border-sidebar-border pl-3">
                        {item.children!.map((child) => {
                          const childActive = isNavChildActive(pathname, child.href);
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={onNavigate}
                              className={cn(
                                "flex h-8 items-center rounded-lg px-2.5 text-[0.78rem] font-medium transition-premium",
                                childActive
                                  ? "bg-sidebar-accent text-foreground"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Card de fila — só quando há demandas novas */}
      {!collapsed && newDemandsCount > 0 && can("/demands") && (
        <div className="shrink-0 px-4 pb-3">
          <Link
            href="/demands"
            onClick={onNavigate}
            className="group/queue relative flex items-center gap-3 overflow-hidden rounded-2xl border border-sidebar-border bg-[radial-gradient(120%_90%_at_100%_0%,color-mix(in_oklch,var(--primary)_28%,transparent),transparent_60%)] bg-sidebar-accent/60 p-3 transition-premium hover:border-border-strong"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[0.8125rem] font-bold tracking-tight">
                {newDemandsCount} {newDemandsCount === 1 ? "demanda nova" : "demandas novas"}
              </span>
              <span className="block truncate text-[0.6875rem] text-muted-foreground">
                Aguardando triagem
              </span>
            </span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-highlight text-highlight-foreground transition-transform group-hover/queue:translate-x-0.5">
              <ArrowRight className="size-4" />
            </span>
          </Link>
        </div>
      )}

      {/* Usuário */}
      <div
        className={cn(
          "shrink-0 border-t border-sidebar-border",
          collapsed ? "p-3" : "p-3"
        )}
      >
        <UserMenu collapsed={collapsed} userName={userName} userEmail={userEmail} />
      </div>
    </div>
  );
}

function UserMenu({
  collapsed,
  userName,
  userEmail,
}: {
  collapsed: boolean;
  userName?: string | null;
  userEmail?: string | null;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const initial = (userName ?? userEmail ?? "U").charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center rounded-xl text-left transition-premium outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/50",
          collapsed ? "justify-center p-1.5" : "gap-3 p-2"
        )}
        title={collapsed ? (userName ?? userEmail ?? "Usuário") : undefined}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--tone-orange),var(--tone-pink))] text-sm font-bold text-white shadow-[inset_0_1px_0_oklch(1_0_0/25%)]">
          {initial}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem] font-semibold text-foreground">
                {userName ?? "Usuário"}
              </span>
              <span className="block truncate text-[0.6875rem] text-muted-foreground">
                {userEmail}
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-60">
        <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
          {isDark ? <Sun /> : <Moon />}
          {isDark ? "Tema claro" : "Tema escuro"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void signOut();
          }}
        >
          <LogOut />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
