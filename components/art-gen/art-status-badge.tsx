import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

type ArtStatus = "queued" | "processing" | "succeeded" | "failed";

const config: Record<
  ArtStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  queued: {
    label: "Na fila",
    variant: "outline",
    icon: <Clock className="size-3" />,
  },
  processing: {
    label: "Gerando",
    variant: "secondary",
    icon: <Loader2 className="size-3 animate-spin" />,
  },
  succeeded: {
    label: "Pronta",
    variant: "default",
    icon: <CheckCircle2 className="size-3" />,
  },
  failed: {
    label: "Falhou",
    variant: "destructive",
    icon: <XCircle className="size-3" />,
  },
};

export function ArtStatusBadge({ status }: { status: ArtStatus }) {
  const { label, variant, icon } = config[status] ?? config.queued;
  return (
    <Badge variant={variant} className="gap-1 text-xs">
      {icon}
      {label}
    </Badge>
  );
}
