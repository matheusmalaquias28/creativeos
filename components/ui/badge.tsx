import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0 text-[0.625rem] font-medium tracking-wide whitespace-nowrap uppercase transition-premium focus-visible:ring-2 focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-border/70 bg-muted/70 text-foreground/90 dark:border-white/8 dark:bg-white/5 dark:text-foreground/80",
        secondary:
          "border-border/60 bg-secondary text-secondary-foreground dark:border-white/6 dark:bg-white/4",
        destructive:
          "border-negative/25 bg-negative/10 text-negative dark:border-negative/20 dark:bg-negative/8",
        outline:
          "border-border bg-background text-muted-foreground dark:border-white/8 dark:bg-transparent",
        ghost:
          "border-transparent bg-transparent text-muted-foreground",
        link:
          "border-transparent text-foreground underline-offset-4",
        positive:
          "border-positive/25 bg-positive/10 text-positive dark:border-positive/20 dark:bg-positive/8",
        warning:
          "border-warning/25 bg-warning/10 text-warning dark:border-warning/20 dark:bg-warning/8",
        "positive-solid":
          "border-transparent bg-positive text-positive-foreground",
        "negative-solid":
          "border-transparent bg-negative text-negative-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
