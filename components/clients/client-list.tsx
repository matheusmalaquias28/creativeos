"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ClientCard } from "@/components/clients/client-card";
import { Input } from "@/components/ui/input";
import { Surface, SurfaceContent } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import type { ClientListItem } from "@/types";

type ClientListProps = {
  clients: ClientListItem[];
};

type ClientListView = "active" | "archived";

function filterClients(clients: ClientListItem[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return clients;

  return clients.filter(
    (client) =>
      client.name.toLowerCase().includes(normalized) ||
      client.slug.toLowerCase().includes(normalized)
  );
}

export function ClientList({ clients }: ClientListProps) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ClientListView>("active");

  const { activeClients, archivedClients } = useMemo(() => {
    const active: ClientListItem[] = [];
    const archived: ClientListItem[] = [];

    for (const client of clients) {
      if (client.status === "archived") {
        archived.push(client);
      } else {
        active.push(client);
      }
    }

    return { activeClients: active, archivedClients: archived };
  }, [clients]);

  const visibleClients =
    view === "active" ? activeClients : archivedClients;
  const filteredClients = useMemo(
    () => filterClients(visibleClients, query),
    [visibleClients, query]
  );

  const emptyMessage = query.trim()
    ? `Nenhum cliente encontrado para “${query.trim()}”.`
    : view === "active"
      ? "Nenhum cliente cadastrado."
      : "Nenhum cliente arquivado.";

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            view === "active"
              ? "Buscar cliente por nome..."
              : "Buscar cliente arquivado..."
          }
          className="pl-10"
          aria-label="Buscar cliente por nome"
        />
      </div>

      {filteredClients.length === 0 ? (
        <Surface variant="dashed" padding="lg">
          <SurfaceContent className="text-center">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </SurfaceContent>
        </Surface>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(12.5rem,13.5rem))]">
          {filteredClients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}

      {(activeClients.length > 0 || archivedClients.length > 0) && (
        <nav
          aria-label="Filtrar clientes"
          className="flex items-center justify-center gap-2 border-t border-border/20 pt-8"
        >
          <button
            type="button"
            onClick={() => setView("active")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs transition-colors",
              view === "active"
                ? "text-foreground"
                : "text-muted-foreground/55 hover:text-muted-foreground"
            )}
          >
            Ativos
            {activeClients.length > 0 && (
              <span className="ml-1 text-muted-foreground/45">
                ({activeClients.length})
              </span>
            )}
          </button>
          <span className="text-[0.625rem] text-muted-foreground/25" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={() => setView("archived")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs transition-colors",
              view === "archived"
                ? "text-foreground"
                : "text-muted-foreground/55 hover:text-muted-foreground"
            )}
          >
            Arquivados
            {archivedClients.length > 0 && (
              <span className="ml-1 text-muted-foreground/45">
                ({archivedClients.length})
              </span>
            )}
          </button>
        </nav>
      )}
    </div>
  );
}
