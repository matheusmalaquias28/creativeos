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
import { linkDemandToClientAction } from "@/actions/demands";
import { CreateClientFromDemandButton } from "@/components/demands/create-client-from-demand-button";
import {
  displayExternalClientName,
  isUsableClientName,
} from "@/lib/demands/normalize-client-name";
import { tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

export type DemandClientOption = {
  id: string;
  name: string;
};

type Props = {
  demandId: string;
  currentClientId: string | null;
  currentClientName?: string | null;
  externalClientName: string;
  clientNotFound: boolean;
  clients: DemandClientOption[];
  compact?: boolean;
  onLinked?: (clientId: string, clientName: string) => void;
};

export function DemandClientLinker({
  demandId,
  currentClientId,
  currentClientName,
  externalClientName,
  clientNotFound,
  clients,
  compact = false,
  onLinked,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const [mounted, setMounted] = useState(false);
  const [linkedClientId, setLinkedClientId] = useState(currentClientId);
  const [linkedClientName, setLinkedClientName] = useState(
    currentClientName ?? null
  );
  const [isUnmatched, setIsUnmatched] = useState(clientNotFound);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const usableExternalName = displayExternalClientName(externalClientName);
  const canCreateFromName = isUsableClientName(externalClientName);

  const sortedClients = useMemo(
    () =>
      [...clients]
        .filter((client) => isUsableClientName(client.name))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [clients]
  );

  const filteredClients = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sortedClients;
    return sortedClients.filter((client) =>
      client.name.toLowerCase().includes(needle)
    );
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
      const width = 280;
      const left = Math.min(
        rect.left,
        window.innerWidth - width - 12
      );
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
    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
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

  function handleLinked(
    clientId: string,
    clientName: string,
    linkedCount = 1
  ) {
    setLinkedClientId(clientId);
    setLinkedClientName(clientName);
    setIsUnmatched(false);
    setOpen(false);
    onLinked?.(clientId, clientName);
    toast.success(
      linkedCount > 1
        ? `${clientName} · ${linkedCount} demandas vinculadas`
        : `Demanda vinculada a ${clientName}`
    );
    router.refresh();
  }

  function handleSelect(client: DemandClientOption) {
    if (client.id === linkedClientId || isPending) {
      setOpen(false);
      return;
    }

    startTransition(async () => {
      const result = await linkDemandToClientAction(demandId, client.id);
      if (result.error) {
        toast.error("Erro ao vincular cliente", { description: result.error });
        return;
      }

      handleLinked(
        result.clientId ?? client.id,
        result.clientName ?? client.name,
        result.linkedCount ?? 1
      );
    });
  }

  const badgeLabel = isUnmatched
    ? usableExternalName
      ? usableExternalName
      : "Pendente de cadastro"
    : linkedClientName ?? usableExternalName ?? "Cliente";

  const menu =
    mounted && open && menuPos
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <div
              role="menu"
              className="fixed z-50 w-[280px] overflow-hidden rounded-xl border border-border bg-popover shadow-[var(--surface-shadow-elevated),var(--inner-highlight)]"
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
                  className="h-8 w-full bg-transparent text-[0.8125rem] text-foreground outline-none placeholder:text-muted-foreground"
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
                        "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[0.8125rem] text-foreground transition-colors hover:bg-accent",
                        client.id === linkedClientId && "bg-accent font-semibold"
                      )}
                    >
                      <span className="truncate">{client.name}</span>
                      {client.id === linkedClientId ? (
                        <span className="shrink-0 rounded-md bg-primary/15 px-1.5 text-[0.6875rem] font-semibold text-primary">
                          atual
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>

              <div className="space-y-2 border-t border-border bg-surface/60 p-2">
                {isUnmatched && canCreateFromName ? (
                  <CreateClientFromDemandButton
                    demandId={demandId}
                    clientName={externalClientName}
                    size="sm"
                    className="w-full"
                    onCreated={(clientId, clientName, linkedCount) =>
                      handleLinked(clientId, clientName, linkedCount)
                    }
                  />
                ) : null}
                {isUnmatched && !canCreateFromName ? (
                  <p className="px-1 py-1 text-xs leading-snug text-muted-foreground">
                    Sem nome válido para cadastro. Vincule a um cliente existente
                    ou cadastre o cliente depois.
                  </p>
                ) : null}
                {linkedClientId ? (
                  <Link
                    href={`/clients/${linkedClientId}`}
                    className="flex h-8 items-center justify-center rounded-lg px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => setOpen(false)}
                  >
                    Abrir ficha do cliente
                  </Link>
                ) : null}
              </div>
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
      onClick={() => setOpen((value) => !value)}
      className={cn(
        "relative z-50 inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-premium outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
        compact ? "max-w-[180px]" : "max-w-[220px]",
        isUnmatched
          ? tones.amber.badge
          : "border-border bg-card text-foreground hover:border-border-strong hover:bg-accent"
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
      <ChevronDown className="size-3 shrink-0 opacity-70" />
    </button>
  );

  return (
    <>
      {trigger}
      {menu}
    </>
  );
}
