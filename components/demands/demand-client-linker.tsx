"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { linkDemandToClientAction } from "@/actions/demands";
import { CreateClientFromDemandButton } from "@/components/demands/create-client-from-demand-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [selectedId, setSelectedId] = useState(currentClientId ?? "");
  const [linkedClientId, setLinkedClientId] = useState(currentClientId);
  const [linkedClientName, setLinkedClientName] = useState(currentClientName ?? null);
  const [isUnmatched, setIsUnmatched] = useState(clientNotFound);
  const [isPending, startTransition] = useTransition();

  const sortedClients = [...clients].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR")
  );

  function handleLink() {
    if (!selectedId || isPending) return;

    startTransition(async () => {
      const result = await linkDemandToClientAction(demandId, selectedId);
      if (result.error) {
        toast.error("Erro ao vincular cliente", { description: result.error });
        return;
      }

      const clientName =
        result.clientName ??
        sortedClients.find((client) => client.id === selectedId)?.name ??
        "Cliente";

      setLinkedClientId(result.clientId ?? selectedId);
      setLinkedClientName(clientName);
      setIsUnmatched(false);
      onLinked?.(result.clientId ?? selectedId, clientName);
      toast.success(`Demanda vinculada a ${clientName}`);
      router.refresh();
    });
  }

  const canSubmit =
    selectedId.length > 0 && selectedId !== linkedClientId && !isPending;

  const clientSelectPlaceholder = compact
    ? "Selecionar cliente"
    : "Selecione um cliente";

  const clientSelectItems = [
    { value: "", label: clientSelectPlaceholder },
    ...sortedClients.map((client) => ({
      value: client.id,
      label: client.name,
    })),
  ];

  function renderClientSelect(triggerClassName?: string) {
    return (
      <Select
        value={selectedId}
        onValueChange={(value) => setSelectedId(value ?? "")}
        disabled={isPending}
        items={clientSelectItems}
      >
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={clientSelectPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {clientSelectItems.map((item) => (
            <SelectItem key={item.value || "__placeholder"} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <p className="text-xs text-amber-400">
          Cliente externo: <span className="font-medium">{externalClientName}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {sortedClients.length > 0 && (
            <>
              <div className="min-w-0 flex-1">
                {renderClientSelect("h-8 px-2 text-xs")}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canSubmit}
                onClick={handleLink}
                className="gap-1.5"
              >
                {isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Link2 className="size-3.5" />
                )}
                Vincular
              </Button>
            </>
          )}
          <CreateClientFromDemandButton
            demandId={demandId}
            clientName={externalClientName}
            onCreated={onLinked}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {isUnmatched ? (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400"
          >
            Sem vínculo automático
          </Badge>
        ) : linkedClientId ? (
          <Link
            href={`/clients/${linkedClientId}`}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            Cliente vinculado: {linkedClientName}
          </Link>
        ) : (
          <Badge variant="outline">Nenhum cliente vinculado</Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Nome recebido na demanda:{" "}
        <span className="font-medium text-foreground">{externalClientName}</span>
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {sortedClients.length > 0 && (
          <>
            <label className="grid min-w-0 flex-1 gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Vincular a um cliente cadastrado
              </span>
              {renderClientSelect("h-10")}
            </label>

            <Button
              type="button"
              disabled={!canSubmit}
              onClick={handleLink}
              variant="outline"
              className="gap-2 sm:shrink-0"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              {linkedClientId ? "Alterar vínculo" : "Vincular cliente"}
            </Button>
          </>
        )}

        {isUnmatched && (
          <CreateClientFromDemandButton
            demandId={demandId}
            clientName={externalClientName}
            size="default"
            className="sm:shrink-0"
            onCreated={onLinked}
          />
        )}
      </div>
    </div>
  );
}
