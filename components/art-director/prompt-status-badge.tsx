import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock, PenLine, Sparkles } from "lucide-react";
import type { PromptJobStatus } from "@/services/art-director";

const config: Record<
  PromptJobStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "warning"; icon: React.ReactNode }
> = {
  draft: { label: "Na fila", variant: "outline", icon: <Clock className="size-3" /> },
  writing_prompt: {
    label: "Dirigindo",
    variant: "secondary",
    icon: <Loader2 className="size-3 animate-spin" />,
  },
  awaiting_approval: {
    label: "Revisar",
    variant: "warning",
    icon: <PenLine className="size-3" />,
  },
  queued: { label: "Aprovado", variant: "outline", icon: <Sparkles className="size-3" /> },
  processing: {
    label: "Gerando",
    variant: "secondary",
    icon: <Loader2 className="size-3 animate-spin" />,
  },
  succeeded: { label: "Pronta", variant: "default", icon: <CheckCircle2 className="size-3" /> },
  failed: { label: "Falhou", variant: "destructive", icon: <XCircle className="size-3" /> },
};

export function PromptStatusBadge({ status }: { status: PromptJobStatus }) {
  const { label, variant, icon } = config[status] ?? config.draft;
  return (
    <Badge variant={variant} className="gap-1">
      {icon}
      {label}
    </Badge>
  );
}
