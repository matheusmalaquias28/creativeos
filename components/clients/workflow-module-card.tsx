import Link from "next/link";
import { ArrowRight, Lock, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { tones, type Tone } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

type WorkflowModuleCardProps = {
  title: string;
  description: React.ReactNode;
  icon: LucideIcon;
  actionLabel?: string;
  href?: string;
  disabled?: boolean;
  /** Tom do tile de ícone. */
  tone?: Tone;
  /** Selo de status no canto superior direito. */
  status?: { label: string; tone: Tone };
  /**
   * Ações próprias (botões). Quando definido, o card deixa de ser um link
   * clicável e renderiza este conteúdo no rodapé.
   */
  footer?: React.ReactNode;
  className?: string;
};

export function WorkflowModuleCard({
  title,
  description,
  icon: Icon,
  actionLabel,
  href,
  disabled = false,
  tone = "violet",
  status,
  footer,
  className,
}: WorkflowModuleCardProps) {
  const isLink = Boolean(href) && !disabled && !footer;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            disabled ? tones.slate.iconTile : tones[tone].iconTile
          )}
        >
          <Icon className="size-[1.125rem]" strokeWidth={2} />
        </span>
        {status && (
          <Badge variant={status.tone}>
            <span className={cn("size-1.5 rounded-full", tones[status.tone].dot)} />
            {status.label}
          </Badge>
        )}
      </div>

      <div className="min-w-0 space-y-1">
        <h3 className="text-[0.9375rem] font-bold tracking-tight text-foreground">
          {title}
        </h3>
        <div className="text-[0.8125rem] leading-relaxed text-muted-foreground">
          {description}
        </div>
      </div>

      {footer ? (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">{footer}</div>
      ) : actionLabel ? (
        <span
          className={cn(
            "mt-auto inline-flex items-center gap-1.5 pt-1 text-[0.8125rem] font-semibold",
            isLink ? "text-primary" : "text-muted-foreground"
          )}
        >
          {isLink ? null : <Lock className="size-3.5" strokeWidth={2} />}
          {actionLabel}
          {isLink && (
            <ArrowRight
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
              strokeWidth={2.25}
            />
          )}
        </span>
      ) : null}
    </>
  );

  const baseClass = "surface-panel flex h-full flex-col gap-4 p-5";

  if (isLink && href) {
    return (
      <Link
        href={href}
        className={cn(
          baseClass,
          "hover-lift group outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          className
        )}
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      aria-disabled={disabled || undefined}
      className={cn(baseClass, disabled && "opacity-70", className)}
    >
      {body}
    </div>
  );
}
