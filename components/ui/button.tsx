import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-premium outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive/50 aria-invalid:ring-destructive/25 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_0_oklch(1_0_0/6%)] hover:opacity-90 active:scale-[0.99] dark:shadow-none",
        outline:
          "border-border bg-card text-foreground hover:border-border hover:bg-muted/60 dark:border-white/8 dark:bg-white/4 dark:text-foreground dark:shadow-none dark:hover:bg-white/7 dark:hover:border-white/12",
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:bg-secondary/90 dark:border-white/6 dark:bg-white/5 dark:hover:bg-white/8",
        ghost:
          "text-muted-foreground hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/6 dark:hover:text-foreground",
        destructive:
          "bg-destructive/12 text-destructive hover:bg-destructive/18 dark:bg-negative/8 dark:text-negative dark:hover:bg-negative/14",
        link:
          "text-foreground/90 underline-offset-4 hover:text-foreground hover:underline",
        positive:
          "border-positive/20 bg-positive/10 text-positive hover:bg-positive/16 dark:border-positive/15 dark:bg-positive/8 dark:hover:bg-positive/14",
      },
      size: {
        default: "h-9 gap-2 px-4",
        xs: "h-7 gap-1 rounded-lg px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-lg px-3 text-[0.8125rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-5 text-[0.9375rem]",
        pill: "h-9 gap-2 rounded-full px-5",
        "pill-sm": "h-8 gap-1.5 rounded-full px-4 text-[0.8125rem]",
        icon: "size-9",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
