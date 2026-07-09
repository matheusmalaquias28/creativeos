import { PageHeader } from "@/components/layout/page-header";
import { layout } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

type DashboardPageProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  headerAction?: React.ReactNode;
  className?: string;
};

export function DashboardPage({
  children,
  title,
  description,
  headerAction,
  className,
}: DashboardPageProps) {
  return (
    <>
      {title && (
        <PageHeader
          title={title}
          description={description}
          action={headerAction}
        />
      )}
      <div className={cn(layout.pageX, layout.pageY, "w-full", className)}>
        {children}
      </div>
    </>
  );
}
