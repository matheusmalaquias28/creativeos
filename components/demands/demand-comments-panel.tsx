import { MessageSquare } from "lucide-react";
import { SectionHeader } from "@/components/layout/section-header";
import { Surface } from "@/components/ui/surface";
import type { DemandComment } from "@/services/demand-comments";

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Comentários da demanda recebidos do WAR (`demanda.nota`). Some quando não há nenhum. */
export function DemandCommentsPanel({ comments }: { comments: DemandComment[] }) {
  if (comments.length === 0) return null;

  return (
    <Surface padding="md" className="space-y-4">
      <SectionHeader
        icon={MessageSquare}
        tone="amber"
        title={`Comentários do WAR (${comments.length})`}
        description="Notas deixadas na demanda pelo time no WAR"
      />
      <ol className="space-y-3">
        {comments.map((comment) => (
          <li key={comment.id} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[0.625rem] font-bold text-muted-foreground">
              {initials(comment.author)}
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className="font-semibold text-foreground">{comment.author ?? "WAR"}</span>
                <time dateTime={comment.createdAt} className="text-muted-foreground">
                  {formatWhen(comment.createdAt)}
                </time>
              </p>
              {comment.body && (
                <p className="text-sm whitespace-pre-wrap text-foreground/90">{comment.body}</p>
              )}
              {comment.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {comment.images.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block size-20 overflow-hidden rounded-lg border border-border bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Anexo do comentário" className="size-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Surface>
  );
}
