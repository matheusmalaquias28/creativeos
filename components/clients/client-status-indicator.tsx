import { cn } from "@/lib/utils";
import { tones, type Tone } from "@/lib/design/tokens";
import type { ClientStatus } from "@/types";

const statusConfig: Record<
  ClientStatus,
  { label: string; dotClass: string; title: string; tone: Tone }
> = {
  active: {
    label: "Ativo",
    title: "Cliente ativo",
    tone: "green",
    dotClass: tones.green.dot,
  },
  onboarding: {
    label: "Onboarding",
    title: "Em processo de onboarding",
    tone: "blue",
    dotClass: tones.blue.dot,
  },
  draft: {
    label: "Falta Materiais",
    title: "Aguardando materiais do cliente",
    tone: "amber",
    dotClass: tones.amber.dot,
  },
  archived: {
    label: "Finalizado",
    title: "Contrato encerrado",
    tone: "slate",
    dotClass: tones.slate.dot,
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
