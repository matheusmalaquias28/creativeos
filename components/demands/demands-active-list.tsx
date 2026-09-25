"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Inbox } from "lucide-react";
import { DemandCard } from "@/components/demands/demand-card";
import { EmptyState } from "@/components/ui/empty-state";
import { groupDemands } from "@/lib/demands/group-demands";
import {
  GROUP_HEADER_CLASSES,
  GROUP_DOT_CLASSES,
} from "@/lib/demands/demand-color";
import { cn } from "@/lib/utils";
import type { DemandClientOption } from "@/components/demands/demand-client-linker";
import type { CreativeDemandListItem } from "@/types/demand";

type Props = {
  initialDemands: CreativeDemandListItem[];
  clients: DemandClientOption[];
};

export function DemandsActiveList({ initialDemands, clients }: Props) {
  const [demands, setDemands] = useState(initialDemands);
  const pendingArchiveRef = useRef<CreativeDemandListItem | null>(null);

  useEffect(() => {
    setDemands(initialDemands);
  }, [initialDemands]);

  const groups = useMemo(() => groupDemands(demands), [demands]);

  const handleArchived = useCallback((demand: CreativeDemandListItem) => {
    pendingArchiveRef.current = demand;
    setDemands((prev) => prev.filter((item) => item.id !== demand.id));
  }, []);

  const handleArchiveRevert = useCallback((demandId: string) => {
    const pending = pendingArchiveRef.current;
    if (!pending || pending.id !== demandId) return;

    setDemands((prev) =>
      [...prev, pending].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    );
    pendingArchiveRef.current = null;
  }, []);

  const handleStatusUpdated = useCallback(
    (demandId: string, status: string) => {
      setDemands((prev) =>
        prev.map((item) =>
          item.id === demandId ? { ...item, status } : item
        )
      );
    },
    []
  );

  const handleClientLinked = useCallback(
    (demandId: string, clientId: string, clientName: string) => {
      setDemands((prev) =>
        prev.map((item) =>
          item.id === demandId
            ? {
                ...item,
                client_id: clientId,
                client_name: clientName,
                client_not_found: false,
              }
            : item
        )
      );
    },
    []
  );

  if (demands.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        tone="cyan"
        title="Nenhuma demanda ativa"
        description="Demandas concluídas aparecem na aba Arquivadas."
      />
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key} className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span
              className={cn("size-2 shrink-0 rounded-full", GROUP_DOT_CLASSES[group.key])}
            />
            <h2
              className={cn("text-sm font-bold tracking-tight", GROUP_HEADER_CLASSES[group.key])}
            >
              {group.label}
            </h2>
            <span className="rounded-md bg-muted px-1.5 text-[0.6875rem] font-semibold tabular-nums text-muted-foreground">
              {group.demands.length}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {group.demands.map((demand) => (
              <DemandCard
                key={demand.id}
                demand={demand}
                clients={clients}
                onArchived={() => handleArchived(demand)}
                onArchiveRevert={() => handleArchiveRevert(demand.id)}
                onStatusUpdated={(status) =>
                  handleStatusUpdated(demand.id, status)
                }
                onClientLinked={handleClientLinked}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
