"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

const MAX_SECONDS = 3600;

function formatTime(seconds: number): string {
  const s = Math.min(seconds, MAX_SECONDS);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

type Props = {
  status: string | null;
  startedAt: string | null;
  elapsedSeconds: number | null;
};

export function DemandTimer({ status, startedAt, elapsedSeconds }: Props) {
  const [elapsed, setElapsed] = useState(0);

  const isTiming = status === "Fazendo" && startedAt;

  useEffect(() => {
    if (!isTiming) return;
    const start = new Date(startedAt!).getTime();

    function tick() {
      const raw = Math.round((Date.now() - start) / 1000);
      setElapsed(Math.min(raw, MAX_SECONDS));
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isTiming, startedAt]);

  if (status === "Concluída" && elapsedSeconds != null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
        <Timer className="size-3.5" />
        Tempo total: {formatElapsed(elapsedSeconds)}
      </span>
    );
  }

  if (!isTiming) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
      <Timer className="size-3.5 animate-pulse" />
      Em execução: {formatTime(elapsed)}
      {elapsed >= MAX_SECONDS && (
        <span className="text-[0.65rem] text-muted-foreground">(máx. 1h)</span>
      )}
    </span>
  );
}
