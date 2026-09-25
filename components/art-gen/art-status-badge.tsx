import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

type ArtStatus = "queued" | "processing" | "succeeded" | "failed";

const config: Record<
  ArtStatus,
  { label: string; variant: "cyan" | "blue" | "green" | "red"; icon: React.ReactNode }
> = {
  queued: {
    label: "Na fila",
    variant: "cyan",
    icon: <Clock className="size-3" />,
  },
  processing: {
    label: "Gerando",
    variant: "blue",
    icon: <Loader2 className="size-3 animate-spin" />,
  },
  succeeded: {
    label: "Pronta",
    variant: "green",
    icon: <CheckCircle2 className="size-3" />,
  },
  failed: {
    label: "Falhou",
    variant: "red",
    icon: <XCircle className="size-3" />,
  },
};

export function ArtStatusBadge({ status }: { status: ArtStatus }) {
  const { label, variant, icon } = config[status] ?? config.queued;
  return (
    <Badge variant={variant} className="gap-1 bg-popover">
      {icon}
      {label}
    </Badge>
  );
}
