import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const surfaceVariants = cva(
  "transition-premium overflow-hidden rounded-2xl border backdrop-blur-xl",
  {
    variants: {
      variant: {
        default:
          "border-border bg-card shadow-sm dark:border-white/7 dark:bg-card dark:shadow-[0_0_0_1px_oklch(1_0_0/6%),0_4px_24px_oklch(0_0_0/45%)]",
        elevated:
          "border-border bg-surface-elevated shadow-md dark:border-white/8 dark:bg-surface-elevated dark:shadow-[0_0_0_1px_oklch(1_0_0/8%),0_8px_32px_oklch(0_0_0/55%)]",
        ghost:
          "border-transparent bg-transparent hover:border-border hover:bg-muted/60 dark:hover:border-white/8 dark:hover:bg-white/4",
        dashed:
          "border-dashed border-border bg-transparent hover:border-border hover:bg-muted/50 dark:border-white/7 dark:hover:border-white/12 dark:hover:bg-white/3",
        terminal:
          "border-white/8 bg-[oklch(0.085_0.007_265/85%)] shadow-[0_0_0_1px_oklch(1_0_0/6%),0_8px_32px_oklch(0_0_0/50%)] backdrop-blur-2xl",
      },
      padding: {
        none: "",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "none",
    },
  }
);

function Surface({
  className,
  variant,
  padding,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof surfaceVariants>) {
  return (
    <div
      data-slot="surface"
      className={cn(surfaceVariants({ variant, padding }), className)}
      {...props}
    />
  );
}

function SurfaceHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="surface-header"
      className={cn("flex flex-col gap-1 px-6 pt-6 pb-6", className)}
      {...props}
    />
  );
}

function SurfaceTitle({
  className,
  ...props
}: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="surface-title"
      className={cn(
        "font-heading text-[0.9375rem] font-medium tracking-heading text-foreground",
        className
      )}
      {...props}
    />
  );
}

function SurfaceDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="surface-description"
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}

function SurfaceContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="surface-content"
      className={cn("px-6 pb-6 pt-0", className)}
      {...props}
    />
  );
}

export {
  Surface,
  SurfaceHeader,
  SurfaceTitle,
  SurfaceDescription,
  SurfaceContent,
  surfaceVariants,
};
