import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const surfaceVariants = cva(
  "transition-premium overflow-hidden rounded-2xl border",
  {
    variants: {
      variant: {
        default:
          "border-border bg-card shadow-[var(--surface-shadow),var(--inner-highlight)]",
        elevated:
          "border-border bg-surface-elevated shadow-[var(--surface-shadow-elevated),var(--inner-highlight)]",
        /** Área rebaixada — agrupa conteúdo dentro de cards ou colunas. */
        inset: "border-border/70 bg-surface",
        ghost:
          "border-transparent bg-transparent hover:border-border hover:bg-card",
        dashed:
          "border-dashed border-border-strong bg-transparent hover:bg-card/60",
        /** Destaque de marca com borda gradiente violeta → lime. */
        brand:
          "ring-brand border-transparent bg-card shadow-[var(--surface-shadow-elevated),var(--inner-highlight)]",
        terminal:
          "border-border bg-surface-elevated shadow-[var(--surface-shadow-elevated),var(--inner-highlight)]",
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
      className={cn("flex flex-col gap-1 px-6 pt-5 pb-5", className)}
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
        "font-heading text-[0.9375rem] font-semibold tracking-heading text-foreground",
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
