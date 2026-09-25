import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: { box: "size-8 rounded-[0.625rem]", icon: "size-4" },
  md: { box: "size-9 rounded-xl", icon: "size-[1.125rem]" },
  lg: { box: "size-12 rounded-2xl", icon: "size-6" },
};

/** Símbolo do Creative OS — tile violeta com faísca lime. */
export function BrandMark({ className, size = "md" }: BrandMarkProps) {
  const s = sizes[size];
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-[linear-gradient(135deg,oklch(0.62_0.21_285),oklch(0.5_0.22_275))] text-white shadow-[inset_0_1px_0_oklch(1_0_0/25%),0_6px_16px_-6px_oklch(0.55_0.22_283/70%)]",
        s.box,
        className
      )}
      aria-hidden
    >
      <Sparkles className={s.icon} strokeWidth={2} />
      <span className="absolute top-1 right-1 size-1.5 rounded-full bg-highlight shadow-[0_0_6px_var(--highlight)]" />
    </span>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex min-w-0 flex-col leading-none", className)}>
      <span className="truncate text-[0.9375rem] font-bold tracking-tight text-foreground">
        Creative OS
      </span>
      <span className="mt-1 truncate text-[0.625rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        Agency Workspace
      </span>
    </span>
  );
}
