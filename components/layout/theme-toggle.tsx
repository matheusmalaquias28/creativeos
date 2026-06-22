"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  compact?: boolean;
};

export function ThemeToggle({ className, compact = false }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  if (!mounted) {
    return (
      <Button
        type="button"
        variant={compact ? "ghost" : "ghost"}
        size={compact ? "icon-sm" : "sm"}
        className={cn(
          compact ? "size-8" : "w-full justify-start gap-2",
          className
        )}
        disabled
        aria-label="Alternar tema"
      >
        <Sun className="size-4" strokeWidth={1.75} />
        {!compact && "Tema"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon-sm" : "sm"}
      className={cn(
        compact
          ? "size-8 text-muted-foreground hover:text-foreground"
          : "w-full justify-start gap-2 text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
    >
      {isDark ? (
        <Sun className="size-4" strokeWidth={1.75} />
      ) : (
        <Moon className="size-4" strokeWidth={1.75} />
      )}
      {!compact && (isDark ? "Modo claro" : "Modo escuro")}
    </Button>
  );
}
