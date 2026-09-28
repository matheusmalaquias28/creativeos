"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreativeStudioDialog } from "./creative-studio-dialog";

type Props = {
  demandId: string;
  hasClient: boolean;
};

/**
 * A porta de entrada da geração de criativos — um botão, uma tela.
 *
 * O modal carrega o estado ao abrir, então o botão não precisa de nada do
 * servidor: a demanda pode ficar aberta horas sem a contagem de artes envelhecer.
 */
export function CreativeStudioButton({ demandId, hasClient }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Sparkles className="size-4" />
        Gerar Criativos
      </Button>

      <CreativeStudioDialog
        demandId={demandId}
        open={open}
        onOpenChange={setOpen}
        hasClient={hasClient}
      />
    </>
  );
}
