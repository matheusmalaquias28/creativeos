import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CreditCard,
  UserX,
  Wallet,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { formatCentsBRL } from "@/lib/format/currency";
import type { SubscriptionDelta, SubscriptionsDashboardSummary } from "@/types/subscription";

function DeltaBadge({ delta }: { delta: SubscriptionDelta }) {
  if (delta.pct === null) {
    const isNew = delta.current > 0;
    return (
      <Badge variant={isNew ? "cyan" : "secondary"}>
        {isNew ? <ArrowUpRight /> : <ArrowRight />}
        vs. mês passado
      </Badge>
    );
  }

  const up = delta.pct > 0;
  const flat = delta.pct === 0;
  const Icon = flat ? ArrowRight : up ? ArrowUpRight : ArrowDownRight;

  return (
    <Badge variant={flat ? "secondary" : up ? "green" : "red"} className="tabular-nums">
      <Icon />
      {up ? "+" : ""}
      {delta.pct}% <span className="font-medium opacity-70">· vs. mês passado</span>
    </Badge>
  );
}

export function SubscriptionsSummary({
  summary,
}: {
  summary: SubscriptionsDashboardSummary;
}) {
  const hasPaymentIssues = summary.paymentIssueCount > 0;
  const hasUnlinked = summary.unlinkedCount > 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Assinaturas ativas"
        value={String(summary.activeCount.current)}
        icon={CreditCard}
        tone="cyan"
        footer={<DeltaBadge delta={summary.activeCount} />}
        className="stagger-1 animate-in-soft"
      />
      <StatCard
        title="Valor mensal (MRR)"
        value={formatCentsBRL(summary.mrrCents.current)}
        icon={Wallet}
        tone="green"
        footer={<DeltaBadge delta={summary.mrrCents} />}
        className="stagger-2 animate-in-soft"
      />
      <StatCard
        title="Problema no pagamento"
        value={summary.paymentIssueCount}
        icon={AlertTriangle}
        tone={hasPaymentIssues ? "red" : "slate"}
        description={hasPaymentIssues ? "Requer atenção" : "Tudo em dia"}
        className="stagger-3 animate-in-soft"
      />
      <StatCard
        title="Sem cliente vinculado"
        value={summary.unlinkedCount}
        icon={UserX}
        tone={hasUnlinked ? "amber" : "slate"}
        description={hasUnlinked ? "Vincule na tabela abaixo" : "Todas vinculadas"}
        className="stagger-4 animate-in-soft"
      />
    </div>
  );
}
