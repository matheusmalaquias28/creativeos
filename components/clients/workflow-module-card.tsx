import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WorkflowModuleCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  actionLabel: string;
  href?: string;
  disabled?: boolean;
};

export function WorkflowModuleCard({
  title,
  description,
  icon: Icon,
  actionLabel,
  href,
  disabled = false,
}: WorkflowModuleCardProps) {
  return (
    <div className={cn("surface-panel flex flex-col gap-6 p-6 hover-lift")}>
      <div className="flex items-start gap-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/45 bg-muted/30">
          <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-medium tracking-heading text-foreground">
            {title}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {href && !disabled ? (
        <Link
          href={href}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
        >
          {actionLabel}
        </Link>
      ) : (
        <Button size="sm" variant="outline" disabled className="w-fit">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
