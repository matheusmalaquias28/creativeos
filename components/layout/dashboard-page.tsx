import { PageHeader, type PageHeaderProps } from "@/components/layout/page-header";
import { layout } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

type DashboardPageProps = {
  children: React.ReactNode;
  title?: string;
  description?: React.ReactNode;
  headerAction?: React.ReactNode;
  /** Abas/filtros renderizados logo abaixo do título. */
  headerContent?: React.ReactNode;
  eyebrow?: PageHeaderProps["eyebrow"];
  backHref?: string;
  backLabel?: string;
  className?: string;
};

export function DashboardPage({
  children,
  title,
  description,
  headerAction,
  headerContent,
  eyebrow,
  backHref,
  backLabel,
  className,
}: DashboardPageProps) {
  return (
    <div className={layout.maxWidth}>
      {title && (
        <PageHeader
          title={title}
          description={description}
          action={headerAction}
          eyebrow={eyebrow}
          backHref={backHref}
          backLabel={backLabel}
        >
          {headerContent}
        </PageHeader>
      )}
      <div className={cn(layout.pageX, layout.pageY, "w-full", className)}>
        {children}
      </div>
    </div>
  );
}
