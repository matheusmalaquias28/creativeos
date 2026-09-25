"use client";

import { useMemo, useState } from "react";
import { Archive, Search, Users } from "lucide-react";
import { ClientCard } from "@/components/clients/client-card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
      : "Nenhum cliente finalizado.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          aria-label="Filtrar clientes"
          value={view}
          onChange={setView}
          options={[
            { value: "active", label: "Ativos", count: activeClients.length },
            {
              value: "archived",
              label: "Finalizados",
              count: archivedClients.length,
              icon: <Archive className="size-3.5" />,
            },
          ]}
        />
        <div className="relative w-full sm:max-w-xs">
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
                : "Buscar cliente finalizado..."
            }
            className="pl-10"
            aria-label="Buscar cliente por nome"
          />
        </div>
      </div>

      {filteredClients.length === 0 ? (
        <EmptyState
          icon={query.trim() ? Search : Users}
          tone="orange"
          title={emptyMessage}
          description={
            query.trim()
              ? "Tente outro termo ou limpe a busca."
              : view === "active"
                ? "Use o botão “Novo cliente” para cadastrar a primeira marca."
                : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {filteredClients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </div>
  );
}
