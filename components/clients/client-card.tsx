import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { getClientStatusConfig } from "@/components/clients/client-status-indicator";
import { CLIENT_OPPORTUNITY_LABELS } from "@/lib/clients/opportunities";
import { tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { clientInitials } from "@/lib/utils/client";
import type { ClientListItem } from "@/types";

export function ClientCard({ client }: { client: ClientListItem }) {
  const initials = clientInitials(client.name);
  const status = getClientStatusConfig(client.status);
  const statusTone = tones[status.tone];
  const opportunityFlags = client.opportunityFlags ?? [];

  return (
    <Link
      href={`/clients/${client.id}`}
      className="group block w-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <article className="surface-panel hover-lift flex h-full flex-col overflow-hidden p-2">
        <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-surface p-4">
          <div
            aria-hidden
            className="bg-dot-grid pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(circle_at_center,black,transparent_75%)]"
          />
          {client.logoUrl ? (
            <img
              src={client.logoUrl}
              alt={`Logo ${client.name}`}
              className="relative max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <span className="relative flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_30%,var(--card)),var(--card))] text-lg font-bold tracking-tight text-foreground/90 ring-1 ring-border">
              {initials}
            </span>
          )}
          <span
            className={cn(
              "absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full border bg-card/90 px-2 py-0.5 text-[0.6875rem] font-semibold backdrop-blur",
              statusTone.border,
              statusTone.text
            )}
            title={status.title}
          >
            <span className={cn("size-1.5 rounded-full", statusTone.dot)} />
            {status.label}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 px-2 pt-3 pb-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold tracking-tight text-foreground">
                {client.name}
              </h3>
              <p className="truncate font-mono text-[0.6875rem] text-muted-foreground">
                /{client.slug}
              </p>
            </div>
            <ArrowUpRight
              className="mt-0.5 size-4 shrink-0 text-muted-foreground/60 transition-premium group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
              strokeWidth={2}
            />
          </div>

          {opportunityFlags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {opportunityFlags.map((flag) => (
                <span
                  key={flag}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.625rem] font-semibold",
                    tones.amber.badge
                  )}
                >
                  <AlertTriangle className="size-2.5" />
                  {CLIENT_OPPORTUNITY_LABELS[flag]}
                </span>
              ))}
            </div>
          )}

          <p className="mt-auto pt-1 text-[0.6875rem] text-muted-foreground">
            Atualizado em{" "}
            {new Date(client.updated_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })}
          </p>
        </div>
      </article>
    </Link>
  );
}
