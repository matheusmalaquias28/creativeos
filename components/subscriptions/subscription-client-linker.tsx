"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, ChevronDown, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { linkSubscriptionToClientAction } from "@/actions/subscriptions";
import { cn } from "@/lib/utils";
import { tones } from "@/lib/design/tokens";

export type SubscriptionClientOption = { id: string; name: string };

type Props = {
  subscriptionId: string;
  currentClientId: string | null;
  currentClientName?: string | null;
  buyerName: string;
  clientNotFound: boolean;
  clients: SubscriptionClientOption[];
};

export function SubscriptionClientLinker({
  subscriptionId,
  currentClientId,
  currentClientName,
  buyerName,
  clientNotFound,
  clients,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [linkedClientId, setLinkedClientId] = useState(currentClientId);
  const [linkedClientName, setLinkedClientName] = useState(currentClientName ?? null);
  const [isUnmatched, setIsUnmatched] = useState(clientNotFound);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [clients]
  );

  const filteredClients = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sortedClients;
    return sortedClients.filter((client) => client.name.toLowerCase().includes(needle));
  }, [query, sortedClients]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setLinkedClientId(currentClientId);
    setLinkedClientName(currentClientName ?? null);
    setIsUnmatched(clientNotFound);
  }, [currentClientId, currentClientName, clientNotFound]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const width = 260;
      const left = Math.min(rect.left, window.innerWidth - width - 12);
      setMenuPos({ top: rect.bottom + 6, left: Math.max(12, left) });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function handleSelect(client: SubscriptionClientOption) {
    if (client.id === linkedClientId || isPending) {
      setOpen(false);
      return;
    }

    startTransition(async () => {
      const result = await linkSubscriptionToClientAction(subscriptionId, client.id);
      if (result.error) {
        toast.error("Erro ao vincular cliente", { description: result.error });
        return;
      }

      setLinkedClientId(result.clientId ?? client.id);
      setLinkedClientName(result.clientName ?? client.name);
      setIsUnmatched(false);
      setOpen(false);
      toast.success(`Assinatura vinculada a ${result.clientName ?? client.name}`);
      router.refresh();
    });
  }

  const badgeLabel = isUnmatched
    ? buyerName || "Sem comprador identificado"
    : (linkedClientName ?? buyerName ?? "Cliente");

  const menu =
    mounted && open && menuPos
      ? createPortal(
          <>
            <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
            <div
              role="menu"
              className="fixed z-50 w-[260px] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-[var(--surface-shadow-elevated),var(--inner-highlight)]"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Pesquisar cliente..."
                  className="h-7 w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>

              <div className="max-h-56 overflow-y-auto p-1">
                {filteredClients.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    Nenhum cliente encontrado
                  </p>
                ) : (
                  filteredClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      role="menuitem"
                      disabled={isPending}
                      onClick={() => handleSelect(client)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-accent",
                        client.id === linkedClientId && "bg-accent font-semibold"
                      )}
                    >
                      <span className="truncate">{client.name}</span>
                      {client.id === linkedClientId ? (
                        <span className="shrink-0 rounded-md bg-primary/15 px-1.5 text-[0.625rem] font-semibold text-primary">atual</span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>

              {linkedClientId ? (
                <div className="border-t border-border p-2">
                  <Link
                    href={`/clients/${linkedClientId}`}
                    className="flex h-8 items-center justify-center rounded-lg px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => setOpen(false)}
                  >
                    Abrir ficha do cliente
                  </Link>
                </div>
              ) : null}
            </div>
          </>,
          document.body
        )
      : null;

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      disabled={isPending}
      onClick={() => setOpen((v) => !v)}
      className={cn(
        "relative inline-flex max-w-[200px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-premium outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
        isUnmatched
          ? cn(tones.amber.badge, "hover:bg-tone-amber/18")
          : "border-border bg-muted text-foreground/90 hover:border-border-strong hover:bg-accent"
      )}
    >
      {isPending ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
      ) : isUnmatched ? (
        <AlertTriangle className="size-3.5 shrink-0" />
      ) : (
        <Building2 className="size-3.5 shrink-0" />
      )}
      <span className="truncate">{badgeLabel}</span>
      <ChevronDown className="size-3 shrink-0 opacity-60" strokeWidth={2.25} />
    </button>
  );

  return (
    <>
      {trigger}
      {menu}
    </>
  );
}
