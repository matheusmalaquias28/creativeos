import { Badge } from "@/components/ui/badge";
import {
  getClientDisplayStatusConfig,
  resolveClientDisplayStatus,
  type ClientDisplayStatus,
} from "@/lib/clients/display-status";
import { tones, type Tone } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import type { ClientStatus } from "@/types";

/** Status de exibição → tom do design system (ver DESIGN.md). */
const DISPLAY_STATUS_TONE: Record<ClientDisplayStatus, Tone> = {
  onboarding_pendente: "red",
  onboarding_incompleto: "amber",
  ativo: "green",
  desativado: "slate",
};

type ClientDisplayStatusBadgeProps = {
  status: ClientStatus;
  className?: string;
};

export function ClientDisplayStatusBadge({
  status,
  className,
}: ClientDisplayStatusBadgeProps) {
  const config = getClientDisplayStatusConfig(status);
  const tone = DISPLAY_STATUS_TONE[resolveClientDisplayStatus(status)];

  return (
    <Badge variant={tone} className={cn("gap-1.5", className)}>
      <span
        role="status"
        aria-label={config.label}
        className={cn("size-1.5 shrink-0 rounded-full", tones[tone].dot)}
      />
      {config.label}
    </Badge>
  );
}
