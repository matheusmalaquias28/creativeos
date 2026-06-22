import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-border bg-card px-3.5 py-2 text-sm shadow-xs transition-premium outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-border focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive/40 aria-invalid:ring-destructive/20 dark:border-white/8 dark:bg-white/5 dark:shadow-none dark:focus-visible:bg-white/7 dark:focus-visible:border-white/14 dark:placeholder:text-muted-foreground/50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
