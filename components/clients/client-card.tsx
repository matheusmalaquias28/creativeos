import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ClientStatusIndicator,
  getClientStatusConfig,
} from "@/components/clients/client-status-indicator";
import { CLIENT_OPPORTUNITY_LABELS } from "@/lib/clients/opportunities";
import { cn } from "@/lib/utils";
import { clientInitials } from "@/lib/utils/client";
import type { ClientListItem } from "@/types";

const statusVariant: Record<
  ClientListItem["status"],
  "default" | "secondary" | "outline"
> = {
  draft: "secondary",
  onboarding: "secondary",
  active: "default",
  archived: "outline",
};

const statusCardStyle: Record<
  ClientListItem["status"],
  { border: string; bg: string; accent: string }
> = {
  active: {
    border: "border-emerald-500/30 hover:border-emerald-500/55",
    bg: "bg-emerald-500/[0.03] group-hover:bg-emerald-500/[0.06]",
    accent: "from-emerald-500/30 to-transparent",
  },
  onboarding: {
    border: "border-sky-500/30 hover:border-sky-500/55",
    bg: "bg-sky-500/[0.03] group-hover:bg-sky-500/[0.06]",
    accent: "from-sky-500/30 to-transparent",
  },
  draft: {
    border: "border-amber-500/30 hover:border-amber-500/55",
    bg: "bg-amber-500/[0.03] group-hover:bg-amber-500/[0.06]",
    accent: "from-amber-500/30 to-transparent",
  },
  archived: {
    border: "border-zinc-500/25 hover:border-zinc-500/45",
    bg: "opacity-75 group-hover:opacity-100 group-hover:bg-zinc-500/[0.04]",
    accent: "from-zinc-500/25 to-transparent",
  },
};

function daysInBase(createdAt: string): number {
  return Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function ClientCard({ client }: { client: ClientListItem }) {
  const initials = clientInitials(client.name);
  const status = getClientStatusConfig(client.status);
  const opportunityFlags = client.opportunityFlags ?? [];
  const cardStyle = statusCardStyle[client.status];
  const days = client.status === "onboarding" ? daysInBase(client.created_at) : null;

  return (
    <Link href={`/clients/${client.id}`} className="group block">
      <article
        className={cn(
          "hover-lift relative flex flex-col gap-5 overflow-hidden rounded-[var(--radius-xl)] border p-6 backdrop-blur-[12px] transition-colors",
          cardStyle.border,
          cardStyle.bg
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r",
            cardStyle.accent
          )}
        />
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <Avatar
              size="lg"
              className="size-11 shrink-0 rounded-xl after:rounded-xl"
            >
              {client.logoUrl ? (
                <AvatarImage
                  src={client.logoUrl}
                  alt={`Logo ${client.name}`}
                  className="rounded-xl object-contain p-1.5"
                />
              ) : null}
              <AvatarFallback className="rounded-xl text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <ClientStatusIndicator
              status={client.status}
              className="absolute -right-0.5 -bottom-0.5"
            />
          </div>

          <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h3 className="truncate font-medium tracking-heading text-foreground">
                {client.name}
              </h3>
              <p className="truncate font-mono text-xs text-muted-foreground">
                /{client.slug}
              </p>
            </div>
            <Badge variant={statusVariant[client.status]} className="shrink-0">
              {status.label}
            </Badge>
          </div>
        </div>

        {opportunityFlags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {opportunityFlags.map((flag) => (
              <Badge
                key={flag}
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 text-amber-400"
              >
                {CLIENT_OPPORTUNITY_LABELS[flag]}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {days !== null ? (
            <span className="flex items-center gap-1.5 text-sky-400/90">
              <Clock className="size-3.5 shrink-0" strokeWidth={1.75} />
              {days === 0
                ? "Entrou hoje"
                : days === 1
                  ? "1 dia na base"
                  : `${days} dias na base`}
            </span>
          ) : (
            <span>
              Atualizado{" "}
              {new Date(client.updated_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
          <ArrowUpRight
            className="size-4 text-muted-foreground/50 transition-premium group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground/70"
            strokeWidth={1.5}
          />
        </div>
      </article>
    </Link>
  );
}
