import { Badge } from "@/components/ui/badge";
import { getClientDisplayStatusConfig } from "@/lib/clients/display-status";
import { cn } from "@/lib/utils";
import type { ClientStatus } from "@/types";

type ClientDisplayStatusBadgeProps = {
  status: ClientStatus;
  className?: string;
};

export function ClientDisplayStatusBadge({
  status,
  className,
}: ClientDisplayStatusBadgeProps) {
  const config = getClientDisplayStatusConfig(status);

  return (
    <Badge
      variant="outline"
      className={cn("gap-2 pr-2.5 font-medium", config.badgeClass, className)}
    >
      <span
        role="status"
        aria-label={config.label}
        className={cn("size-2.5 shrink-0 rounded-full border-2 border-card", config.dotClass)}
      />
      {config.label}
    </Badge>
  );
}
