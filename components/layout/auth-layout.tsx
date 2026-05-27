import Link from "next/link";
import { Brain } from "lucide-react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-8 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3 transition-premium hover:opacity-80">
          <div className="flex size-8 items-center justify-center rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm">
            <Brain className="size-4 text-foreground/90" strokeWidth={1.75} />
          </div>
          <span className="text-sm font-medium tracking-heading">Creative OS</span>
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-[420px] animate-in-soft">{children}</div>
      </div>
    </div>
  );
}
