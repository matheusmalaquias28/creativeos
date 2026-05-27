import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const surfaceVariants = cva(
  "transition-premium overflow-hidden rounded-xl border backdrop-blur-md",
  {
    variants: {
      variant: {
        default:
          "border-border/50 bg-card/45 hover:border-border/70",
        elevated:
          "border-border/45 bg-surface-elevated hover:border-border/65",
        ghost:
          "border-transparent bg-transparent hover:border-border/40 hover:bg-card/30",
        dashed:
          "border-dashed border-border/40 bg-transparent hover:border-border/55 hover:bg-card/25",
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
      className={cn("flex flex-col gap-1 px-6 pt-6 pb-0", className)}
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
      className={cn("px-6 pb-6 pt-4", className)}
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
