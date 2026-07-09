import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

export function ClientCard({ client }: { client: ClientListItem }) {
  const initials = clientInitials(client.name);
  const status = getClientStatusConfig(client.status);
  const opportunityFlags = client.opportunityFlags ?? [];

  return (
    <Link href={`/clients/${client.id}`} className="group block w-full max-w-[13.5rem]">
      <article
        className={cn(
          "surface-panel hover-lift flex flex-col gap-3.5 p-4",
          "group-hover:border-border group-hover:shadow-[var(--surface-shadow-hover)] dark:group-hover:border-white/12 dark:group-hover:bg-[oklch(0.095_0.007_265/85%)]"
        )}
      >
        <div className="relative w-full">
          <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/45 p-3 dark:border-border/50 dark:bg-muted/25">
            {client.logoUrl ? (
              <img
                src={client.logoUrl}
                alt={`Logo ${client.name}`}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="font-heading text-2xl font-medium tracking-heading text-muted-foreground/80">
                {initials}
              </span>
            )}
          </div>
          <ClientStatusIndicator
            status={client.status}
            className="absolute -right-0.5 -bottom-0.5"
          />
        </div>

        <div className="min-w-0 space-y-2">
          <div className="space-y-0.5">
            <h3 className="truncate text-sm font-medium tracking-heading text-foreground">
              {client.name}
            </h3>
            <p className="truncate font-mono text-[0.6875rem] text-muted-foreground">
              /{client.slug}
            </p>
          </div>

          <Badge variant={statusVariant[client.status]} className="w-fit text-[0.6875rem]">
            {status.label}
          </Badge>

          {opportunityFlags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {opportunityFlags.map((flag) => (
                <Badge
                  key={flag}
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[0.625rem] text-amber-700 dark:text-amber-400"
                >
                  {CLIENT_OPPORTUNITY_LABELS[flag]}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border/40 pt-2.5 text-[0.6875rem] text-muted-foreground">
          <span className="truncate">
            {new Date(client.updated_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })}
          </span>
          <ArrowUpRight
            className="size-3.5 shrink-0 text-muted-foreground/50 transition-premium group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground/70"
            strokeWidth={1.5}
          />
        </div>
      </article>
    </Link>
  );
}
