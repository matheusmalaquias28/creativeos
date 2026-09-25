import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Link de volta (páginas de detalhe). */
  backHref?: string;
  backLabel?: string;
  /** Linha acima do título — contexto, status, badges. */
  eyebrow?: React.ReactNode;
  /** Conteúdo abaixo do título (abas, filtros, toolbar). */
  children?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  action,
  backHref,
  backLabel = "Voltar",
  eyebrow,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8 xl:px-10",
        className
      )}
    >
      {backHref && (
        <Link
          href={backHref}
          className="group mb-4 inline-flex items-center gap-1 rounded-lg text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          {backLabel}
        </Link>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          {eyebrow && (
            <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <h1 className="text-[1.625rem] leading-tight font-bold tracking-[-0.03em] text-foreground sm:text-[1.875rem]">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
        )}
      </div>

      {children && <div className="mt-5">{children}</div>}
    </header>
  );
}
