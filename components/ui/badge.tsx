import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-[1.375rem] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2.5 py-0 text-[0.6875rem] font-semibold whitespace-nowrap transition-premium focus-visible:ring-2 focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-secondary-foreground",
        secondary: "border-transparent bg-muted text-muted-foreground",
        destructive: "border-tone-red/25 bg-tone-red/12 text-tone-red",
        outline: "border-border bg-transparent text-muted-foreground",
        ghost: "border-transparent bg-transparent text-muted-foreground",
        link: "border-transparent text-primary underline-offset-4",
        primary: "border-transparent bg-primary text-primary-foreground",
        highlight: "border-transparent bg-highlight text-highlight-foreground",
        positive: "border-tone-green/25 bg-tone-green/12 text-tone-green",
        warning: "border-tone-amber/25 bg-tone-amber/12 text-tone-amber",
        "positive-solid": "border-transparent bg-positive text-positive-foreground",
        "negative-solid": "border-transparent bg-negative text-negative-foreground",
        violet: "border-tone-violet/25 bg-tone-violet/12 text-tone-violet",
        lime: "border-tone-lime/25 bg-tone-lime/12 text-tone-lime",
        cyan: "border-tone-cyan/25 bg-tone-cyan/12 text-tone-cyan",
        blue: "border-tone-blue/25 bg-tone-blue/12 text-tone-blue",
        orange: "border-tone-orange/25 bg-tone-orange/12 text-tone-orange",
        pink: "border-tone-pink/25 bg-tone-pink/12 text-tone-pink",
        amber: "border-tone-amber/25 bg-tone-amber/12 text-tone-amber",
        green: "border-tone-green/25 bg-tone-green/12 text-tone-green",
        red: "border-tone-red/25 bg-tone-red/12 text-tone-red",
        slate: "border-tone-slate/25 bg-tone-slate/12 text-tone-slate",
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
