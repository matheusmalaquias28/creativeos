import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ClientStatusIndicator,
  getClientStatusConfig,
} from "@/components/clients/client-status-indicator";
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

  return (
    <Link href={`/clients/${client.id}`} className="group block">
      <article
        className={cn(
          "surface-panel hover-lift flex flex-col gap-5 p-6",
          "group-hover:bg-card/55"
        )}
      >
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

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Atualizado{" "}
            {new Date(client.updated_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
          <ArrowUpRight
            className="size-4 text-muted-foreground/50 transition-premium group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground/70"
            strokeWidth={1.5}
          />
        </div>
      </article>
    </Link>
  );
}
