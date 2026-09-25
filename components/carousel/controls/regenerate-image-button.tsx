"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateImageViaGerador } from "@/lib/carousel/generate-image-client";

type Props = {
  prompt: string;
  aspect: string;
  onDone: (url: string) => void;
  /** "button" = full-width labeled button; "icon" = compact icon (grid slots). */
  variant?: "button" | "icon";
  label?: string;
  className?: string;
};

export function RegenerateImageButton({
  prompt,
  aspect,
  onDone,
  variant = "button",
  label = "Regenerar imagem (prompt original)",
  className,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const url = await generateImageViaGerador(prompt, aspect);
      onDone(url);
      toast.success("Imagem regenerada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao regenerar");
    } finally {
      setLoading(false);
    }
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={run}
        disabled={loading}
        title="Regenerar imagem (prompt original)"
        className={cn(
          "flex size-6 items-center justify-center rounded-md border border-border bg-popover/90 text-foreground shadow-[var(--surface-shadow)] transition-colors hover:bg-accent disabled:opacity-60",
          className
        )}
      >
        {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={loading}
      className={cn(
        "flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/8 text-[0.8125rem] font-semibold text-primary transition-colors hover:bg-primary/14 disabled:opacity-60",
        className
      )}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
      {loading ? "Regenerando…" : label}
    </button>
  );
}
