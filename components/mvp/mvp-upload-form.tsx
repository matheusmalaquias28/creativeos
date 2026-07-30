"use client";

import { useActionState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { createMvpProjectAction, type MvpActionState } from "@/actions/mvp";

const initialState: MvpActionState = {};

export function MvpUploadForm() {
  const [state, formAction, isPending] = useActionState(createMvpProjectAction, initialState);

  return (
    <form
      action={formAction}
      className="rounded-xl border border-white/10 bg-black/15 p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="mvp-title" className="text-xs font-medium text-muted-foreground">
            Nome do MVP (opcional — usa o nome do arquivo se vazio)
          </label>
          <input
            id="mvp-title"
            name="title"
            type="text"
            placeholder="Ex: Guia Definitivo de Tráfego Pago"
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <label htmlFor="mvp-docx" className="text-xs font-medium text-muted-foreground">
            Conteúdo do MVP (.docx)
          </label>
          <input
            id="mvp-docx"
            name="docx"
            type="file"
            required
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="w-full cursor-pointer rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-foreground"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-medium text-foreground transition-premium hover:bg-white/15 disabled:opacity-60"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          {isPending ? "Lendo e organizando..." : "Criar MVP"}
        </button>
      </div>
      {state.error && <p className="mt-3 text-sm text-red-400">{state.error}</p>}
      <p className="mt-3 text-xs text-muted-foreground/70">
        O conteúdo será organizado automaticamente em páginas A4 — você revisa o preview, envia
        logo e referências, e só então gera o MVP no Magnific Spaces.
      </p>
    </form>
  );
}
