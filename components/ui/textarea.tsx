import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[100px] w-full rounded-lg border border-border/50 bg-input/30 px-3.5 py-2.5 text-sm transition-premium outline-none placeholder:text-muted-foreground/70 focus-visible:border-border focus-visible:bg-input/45 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
