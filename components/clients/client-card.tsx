import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Client } from "@/types";

const statusLabels: Record<Client["status"], string> = {
  draft: "Rascunho",
  onboarding: "Onboarding",
  active: "Ativo",
  archived: "Arquivado",
};

const statusVariant: Record<
  Client["status"],
  "default" | "secondary" | "outline"
> = {
  draft: "outline",
  onboarding: "secondary",
  active: "default",
  archived: "outline",
};

export function ClientCard({ client }: { client: Client }) {
  return (
    <Link href={`/clients/${client.id}`} className="group block">
      <article
        className={cn(
          "surface-panel hover-lift flex flex-col gap-5 p-6",
          "group-hover:bg-card/55"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h3 className="truncate font-medium tracking-heading text-foreground">
              {client.name}
            </h3>
            <p className="truncate font-mono text-xs text-muted-foreground">
              /{client.slug}
            </p>
          </div>
          <Badge variant={statusVariant[client.status]}>
            {statusLabels[client.status]}
          </Badge>
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
