"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ClientStatusIndicator } from "@/components/clients/client-status-indicator";
import { updateClientStatusAction } from "@/actions/clients";
import type { ClientStatus } from "@/types";

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: "onboarding", label: "Onboarding" },
  { value: "draft", label: "Falta Materiais" },
  { value: "active", label: "Ativo" },
  { value: "archived", label: "Finalizado" },
];

type Props = {
  clientId: string;
  currentStatus: ClientStatus;
};

export function ClientStatusSelect({ clientId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleChange(value: ClientStatus | null) {
    if (!value || value === currentStatus) return;
    startTransition(async () => {
      const result = await updateClientStatusAction(clientId, value);
      if (result.error) {
        toast.error("Erro ao atualizar status", { description: result.error });
      } else {
        toast.success("Status atualizado");
      }
    });
  }

  const current = STATUS_OPTIONS.find((o) => o.value === currentStatus);

  return (
    <Select<ClientStatus> value={currentStatus} onValueChange={handleChange}>
      <SelectTrigger
        className="w-auto min-w-[168px] gap-2 opacity-100 disabled:opacity-60"
        disabled={isPending}
        aria-label="Status do cliente"
      >
        <ClientStatusIndicator status={currentStatus} size="sm" />
        <SelectValue>{current?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <span className="flex items-center gap-2">
              <ClientStatusIndicator status={opt.value} size="sm" />
              {opt.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
