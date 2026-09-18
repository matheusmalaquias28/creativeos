"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { assignSubscriptionSalespersonAction } from "@/actions/subscriptions";
import { SALESPERSON_OPTIONS, type Salesperson } from "@/types/subscription";

const NONE_VALUE = "__none__";

type Props = {
  subscriptionId: string;
  currentSalesperson: Salesperson | null;
};

export function SubscriptionSalespersonSelect({
  subscriptionId,
  currentSalesperson,
}: Props) {
  const [value, setValue] = useState<Salesperson | typeof NONE_VALUE>(
    currentSalesperson ?? NONE_VALUE
  );
  const [isPending, startTransition] = useTransition();

  function handleChange(next: Salesperson | typeof NONE_VALUE | null) {
    if (!next || next === value) return;
    const salesperson = next === NONE_VALUE ? null : next;
    setValue(next);

    startTransition(async () => {
      const result = await assignSubscriptionSalespersonAction(subscriptionId, salesperson);
      if (result.error) {
        toast.error("Erro ao atualizar vendedor", { description: result.error });
        setValue(currentSalesperson ?? NONE_VALUE);
      }
    });
  }

  const current = SALESPERSON_OPTIONS.find((o) => o.value === value);

  return (
    <Select<Salesperson | typeof NONE_VALUE> value={value} onValueChange={handleChange}>
      <SelectTrigger
        className="h-8 w-auto min-w-[128px] text-xs opacity-100 disabled:opacity-60"
        disabled={isPending}
        aria-label="Vendedor responsável"
      >
        <SelectValue placeholder="Sem vendedor">{current?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>
          <span className="text-muted-foreground">Sem vendedor</span>
        </SelectItem>
        {SALESPERSON_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
