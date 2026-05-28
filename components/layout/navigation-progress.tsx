"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const prevPath = useRef(pathname);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor?.href) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      try {
        const url = new URL(anchor.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === pathname && url.search === window.location.search) {
          return;
        }
        setActive(true);
      } catch {
        /* ignore invalid href */
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      const timer = setTimeout(() => setActive(false), 120);
      return () => clearTimeout(timer);
    }
    setActive(false);
  }, [pathname]);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[90] h-0.5 overflow-hidden transition-opacity duration-200",
        active ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="h-full w-1/3 animate-route-progress bg-gradient-to-r from-transparent via-foreground/70 to-transparent" />
    </div>
  );
}
