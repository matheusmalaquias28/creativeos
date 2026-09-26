"use client";

import { useEffect, useState } from "react";

// ─── Anchored popover positioning ──────────────────────────────────────────
// The picker panels used to be `position: absolute` inside the sidebar, which
// has `overflow-y-auto` (so overflow-x is clipped). Panels wider than the
// sidebar got hidden. We render them in a portal with fixed positioning,
// clamped to the viewport, so they always show in full.

type PopoverPos = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

export function usePopoverPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  fixedWidth: number,
  matchAnchorWidth = false,
  gap = 8
): PopoverPos | null {
  const [pos, setPos] = useState<PopoverPos | null>(null);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = matchAnchorWidth ? r.width : fixedWidth;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const openUp = r.bottom > window.innerHeight * 0.62;
      if (openUp) {
        setPos({
          left,
          width,
          bottom: window.innerHeight - r.top + gap,
          maxHeight: r.top - gap - 8,
        });
      } else {
        setPos({
          left,
          width,
          top: r.bottom + gap,
          maxHeight: window.innerHeight - r.bottom - gap - 8,
        });
      }
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef, fixedWidth, matchAnchorWidth, gap]);

  return pos;
}
