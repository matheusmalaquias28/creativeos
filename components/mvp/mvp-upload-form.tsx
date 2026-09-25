"use client";

import { useActionState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { createMvpProjectAction, type MvpActionState } from "@/actions/mvp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: MvpActionState = {};

export function MvpUploadForm() {
  const [state, formAction, isPending] = useActionState(createMvpProjectAction, initialState);

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-border bg-card p-5 shadow-[var(--surface-shadow),var(--inner-highlight)]"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="mvp-title">
            Nome do MVP{" "}
            <span className="font-normal text-muted-foreground">
              (opcional — usa o nome do arquivo se vazio)
            </span>
          </Label>
          <Input
            id="mvp-title"
            name="title"
            type="text"
            placeholder="Ex: Guia Definitivo de Tráfego Pago"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="mvp-docx">Conteúdo do MVP (.docx)</Label>
          <input
            id="mvp-docx"
            name="docx"
            type="file"
            required
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="h-10 w-full cursor-pointer rounded-xl border border-border bg-input px-1.5 py-1.5 text-sm text-muted-foreground transition-premium hover:border-border-strong focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none file:mr-3 file:h-full file:cursor-pointer file:rounded-lg file:border-0 file:bg-muted file:px-3 file:text-xs file:font-semibold file:text-foreground"
          />
        </div>
        <Button type="submit" disabled={isPending} className="h-10 shrink-0">
          {isPending ? <Loader2 className="animate-spin" /> : <FileUp />}
          {isPending ? "Lendo e organizando..." : "Criar MVP"}
        </Button>
      </div>
      {state.error && <p role="alert" className="mt-3 text-sm font-medium text-tone-red">{state.error}</p>}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        O conteúdo será organizado automaticamente em páginas A4 — você revisa o preview, envia
        logo e referências, e só então gera o MVP no Magnific Spaces.
      </p>
    </form>
  );
}
