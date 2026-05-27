"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClientAction, type ClientActionState } from "@/actions/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ClientActionState = {};

export function CreateClientForm() {
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
    <form action={formAction} className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-2">
        <label
          htmlFor="client-name"
          className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          Nome do cliente
        </label>
        <Input
          id="client-name"
          name="name"
          placeholder="Marca ou cliente"
          required
          className="h-11"
        />
      </div>
      <Button type="submit" disabled={pending} className="shrink-0 sm:h-11">
        {pending ? "Criando..." : "Novo cliente"}
      </Button>
    </form>
  );
}
