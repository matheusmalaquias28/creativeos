"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowRight, CornerDownLeft, Moon, Plus, Search, Sun, type LucideIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useNavAccess } from "@/components/layout/nav-access";
import { tones, type Tone } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

type CommandItem = {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  tone: Tone;
  hint?: string;
  keywords?: string;
  run: () => void;
};

type CommandMenuContextValue = { open: () => void };

const CommandMenuContext = createContext<CommandMenuContextValue>({ open: () => {} });

export function useCommandMenu() {
  return useContext(CommandMenuContext);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <CommandMenuContext.Provider value={value}>
      {children}
      <CommandMenuDialog open={isOpen} onOpenChange={setIsOpen} />
    </CommandMenuContext.Provider>
  );
}

function CommandMenuDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { sections, can } = useNavAccess();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<CommandItem[]>(() => {
    const go = (href: string) => () => {
      onOpenChange(false);
      router.push(href);
    };

    const nav: CommandItem[] = sections.flatMap((section) =>
      section.items.flatMap((item) => {
        const base: CommandItem = {
          id: item.href,
          label: item.label,
          group: section.label,
          icon: item.icon,
          tone: item.tone,
          keywords: item.keywords,
          hint: "Ir para",
          run: go(item.href),
        };
        const children: CommandItem[] = (item.children ?? [])
          .filter((child) => child.href !== item.href)
          .map((child) => ({
            id: child.href,
            label: `${item.label} · ${child.label}`,
            group: section.label,
            icon: item.icon,
            tone: item.tone,
            keywords: item.keywords,
            hint: "Ir para",
            run: go(child.href),
          }));
        return [base, ...children];
      })
    );

    const isDark = resolvedTheme === "dark";
    const actions: CommandItem[] = [
      ...(can("/clients") ? [{
        id: "action:new-client",
        label: "Novo cliente",
        group: "Ações rápidas",
        icon: Plus,
        tone: "orange",
        keywords: "cadastrar criar marca",
        run: go("/clients?novo=1"),
      } satisfies CommandItem] : []),
      {
        id: "action:theme",
        label: isDark ? "Mudar para tema claro" : "Mudar para tema escuro",
        group: "Ações rápidas",
        icon: isDark ? Sun : Moon,
        tone: "slate",
        keywords: "tema dark light modo aparência",
        run: () => {
          setTheme(isDark ? "light" : "dark");
          onOpenChange(false);
        },
      },
    ];

    return [...actions, ...nav];
  }, [onOpenChange, resolvedTheme, router, setTheme, sections, can]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return items;
    return items.filter((item) =>
      normalize(`${item.label} ${item.group} ${item.keywords ?? ""}`).includes(q)
    );
  }, [items, query]);

  const groups = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      filtered[activeIndex]?.run();
    }
  }

  let runningIndex = -1;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[80] bg-background/60 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          className="fixed top-[14vh] left-1/2 z-[80] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[var(--surface-shadow-elevated),var(--inner-highlight)] outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0"
          onKeyDown={onKeyDown}
        >
          <DialogPrimitive.Title className="sr-only">Buscar na plataforma</DialogPrimitive.Title>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar páginas e ações…"
              className="h-14 w-full bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground/70"
            />
            <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 text-[0.625rem] font-semibold text-muted-foreground sm:inline">
              ESC
            </kbd>
          </div>

          <div ref={listRef} className="max-h-[min(24rem,55vh)] overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                Nada encontrado para “{query}”.
              </p>
            ) : (
              groups.map(([group, groupItems]) => (
                <div key={group} className="pb-1">
                  <p className="px-3 pt-2 pb-1.5 text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
                    {group}
                  </p>
                  {groupItems.map((item) => {
                    runningIndex += 1;
                    const index = runningIndex;
                    const active = index === activeIndex;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-index={index}
                        onMouseMove={() => setActiveIndex(index)}
                        onClick={item.run}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                          active ? "bg-accent text-accent-foreground" : "text-foreground/90"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-lg",
                            tones[item.tone].iconTile
                          )}
                        >
                          <Icon className="size-3.5" strokeWidth={2} />
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {active ? (
                          <CornerDownLeft className="size-3.5 text-muted-foreground" />
                        ) : (
                          item.hint && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
                              {item.hint}
                              <ArrowRight className="size-3" />
                            </span>
                          )
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-border bg-surface/60 px-4 py-2.5 text-[0.6875rem] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-border bg-muted px-1">↑</kbd>
              <kbd className="rounded border border-border bg-muted px-1">↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-border bg-muted px-1">↵</kbd>
              abrir
            </span>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
