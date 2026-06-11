"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { formatArteTexts } from "@/lib/demands/format-arte-texts";
import { cn } from "@/lib/utils";
import type { DemandArte } from "@/types/demand";

type Props = {
  arte: DemandArte;
  arteIndex?: number;
  className?: string;
};

export function CopyArteTextsButton({ arte, arteIndex, className }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = formatArteTexts(arte);
    if (!text) {
      toast.error("Esta arte não tem textos para copiar");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(
        arteIndex != null
          ? `Textos da arte ${arteIndex + 1} copiados`
          : "Textos copiados"
      );
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar os textos");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "gap-1.5",
        className
      )}
    >
      {copied ? (
        <Check className="size-3.5" />
      ) : (
        <Copy className="size-3.5" />
      )}
      Copiar textos
    </button>
  );
}
