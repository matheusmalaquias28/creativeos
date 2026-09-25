"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClientAction, type ClientActionState } from "@/actions/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const initialState: ClientActionState = {};

type CreateClientFormProps = {
  /** "inline": campo e botão lado a lado; "stacked": empilhado (dialogs). */
  layout?: "inline" | "stacked";
  autoFocus?: boolean;
};

export function CreateClientForm({ layout = "inline", autoFocus }: CreateClientFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createClientAction,
    initialState
  );

  useEffect(() => {
    if (state.success && state.clientId) {
      toast.success("Cliente criado com sucesso");
      router.push(`/clients/${state.clientId}`);
    }
    if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <form
      action={formAction}
      className={cn(
        "flex flex-col gap-4",
        layout === "inline" && "sm:flex-row sm:items-end"
      )}
    >
      <div className="flex-1 space-y-2">
        <Label htmlFor="client-name">Nome do cliente</Label>
        <Input
          id="client-name"
          name="name"
          placeholder="Marca ou cliente"
          required
          autoFocus={autoFocus}
          className="h-11"
        />
      </div>
      <Button
        type="submit"
        disabled={pending}
        className={cn("shrink-0", layout === "inline" ? "sm:h-11" : "h-11 w-full")}
      >
        {pending ? "Criando..." : "Criar cliente"}
      </Button>
    </form>
  );
}
