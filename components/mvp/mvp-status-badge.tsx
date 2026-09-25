import { Badge } from "@/components/ui/badge";
import type { MvpStatus } from "@/types/mvp";

type BadgeVariant = "blue" | "cyan" | "red" | "pink" | "green";

const STATUS_META: Record<MvpStatus, { label: string; variant: BadgeVariant }> = {
  organizing: { label: "Organizando", variant: "blue" },
  organized: { label: "Pronto p/ gerar", variant: "cyan" },
  organize_failed: { label: "Falha na organização", variant: "red" },
  generating: { label: "Gerando", variant: "pink" },
  ready: { label: "MVP pronto", variant: "green" },
  failed: { label: "Falhou", variant: "red" },
};

export function MvpStatusBadge({ status }: { status: MvpStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.organized;
  return (
    <Badge variant={meta.variant} className="shrink-0">
      {meta.label}
    </Badge>
  );
}
