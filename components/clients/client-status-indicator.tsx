import { cn } from "@/lib/utils";
import type { ClientStatus } from "@/types";

const statusConfig: Record<
  ClientStatus,
  { label: string; dotClass: string; title: string }
> = {
  active: {
    label: "Ativo",
    title: "Cliente ativo",
    dotClass: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]",
  },
  onboarding: {
    label: "Onboarding",
    title: "Em processo de onboarding",
    dotClass: "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.4)]",
  },
  draft: {
    label: "Falta Materiais",
    title: "Aguardando materiais do cliente",
    dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]",
  },
  archived: {
    label: "Finalizado",
    title: "Contrato encerrado",
    dotClass: "bg-zinc-400 shadow-[0_0_8px_rgba(161,161,170,0.35)]",
  },
};

export function getClientStatusConfig(status: ClientStatus) {
  return statusConfig[status];
}

type ClientStatusIndicatorProps = {
  status: ClientStatus;
  className?: string;
  size?: "sm" | "md";
};

export function ClientStatusIndicator({
  status,
  className,
  size = "md",
}: ClientStatusIndicatorProps) {
  const config = statusConfig[status];
  const sizeClass = size === "sm" ? "size-2.5" : "size-3";

  return (
    <span
      role="status"
      title={config.title}
      aria-label={config.title}
      className={cn(
        "shrink-0 rounded-full border-2 border-card",
        sizeClass,
        config.dotClass,
        className
      )}
    />
  );
}
