"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsIndicator,
  TabsPanel,
} from "@/components/ui/tabs";
import { ClientCard } from "@/components/clients/client-card";
import type { ClientListItem } from "@/types";

type Props = {
  clients: ClientListItem[];
};

export function ClientList({ clients }: Props) {
  const [query, setQuery] = useState("");

  const active = clients.filter((c) => c.status !== "archived");
  const finished = clients.filter((c) => c.status === "archived");

  function filter(list: ClientListItem[]) {
    const q = query.trim().toLowerCase();
    return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
  }

  const filteredActive = filter(active);
  const filteredFinished = filter(finished);

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          type="search"
          placeholder="Buscar cliente..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Ativos
            <span className="ml-1 tabular-nums text-xs text-muted-foreground">
              ({active.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="finished">
            Finalizados
            <span className="ml-1 tabular-nums text-xs text-muted-foreground">
              ({finished.length})
            </span>
          </TabsTrigger>
          <TabsIndicator />
        </TabsList>

        <TabsPanel value="active" className="pt-5">
          <ClientGrid clients={filteredActive} query={query} />
        </TabsPanel>

        <TabsPanel value="finished" className="pt-5">
          <ClientGrid clients={filteredFinished} query={query} />
        </TabsPanel>
      </Tabs>
    </div>
  );
}

function ClientGrid({
  clients,
  query,
}: {
  clients: ClientListItem[];
  query: string;
}) {
  if (clients.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {query.trim()
          ? `Nenhum cliente encontrado para "${query}".`
          : "Nenhum cliente nesta categoria."}
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {clients.map((client) => (
        <ClientCard key={client.id} client={client} />
      ))}
    </div>
  );
}
