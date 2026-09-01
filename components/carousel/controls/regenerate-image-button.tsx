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
          "flex size-6 items-center justify-center rounded-md bg-black/50 text-white shadow transition-colors hover:bg-black/70 disabled:opacity-60",
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
        "flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/5 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-60",
        className
      )}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
      {loading ? "Regenerando…" : label}
    </button>
  );
}
