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
    title: "Pendente de onboarding",
    dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]",
  },
  draft: {
    label: "Pendente",
    title: "Aguardando início do onboarding",
    dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]",
  },
  archived: {
    label: "Inativo",
    title: "Cliente inativo",
    dotClass: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]",
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
