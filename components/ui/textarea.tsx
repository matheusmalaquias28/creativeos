import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[100px] w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm shadow-xs transition-premium outline-none placeholder:text-muted-foreground focus-visible:border-border focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/8 dark:bg-white/5 dark:shadow-none dark:placeholder:text-muted-foreground/50 dark:focus-visible:bg-white/7 dark:focus-visible:border-white/14",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
