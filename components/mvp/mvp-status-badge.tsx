import { cn } from "@/lib/utils";
import type { MvpStatus } from "@/types/mvp";

const STATUS_META: Record<MvpStatus, { label: string; className: string }> = {
  organizing: { label: "Organizando", className: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  organized: { label: "Pronto p/ gerar", className: "border-white/15 bg-white/5 text-foreground/80" },
  organize_failed: { label: "Falha na organização", className: "border-red-500/40 bg-red-500/10 text-red-300" },
  generating: { label: "Gerando", className: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  ready: { label: "MVP pronto", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  failed: { label: "Falhou", className: "border-red-500/40 bg-red-500/10 text-red-300" },
};

export function MvpStatusBadge({ status }: { status: MvpStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.organized;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium",
        meta.className
      )}
    >
      {meta.label}
    </span>
  );
}
