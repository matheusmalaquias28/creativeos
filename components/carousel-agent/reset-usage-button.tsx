"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Zera o teto diário de imagens do agente. O teto continua valendo depois. */
export function ResetUsageButton({ used, limit }: { used: number; limit: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  async function reset() {
    if (
      !confirm(
        `Zerar o limite de imagens do agente? As ${used} imagens das últimas 24h deixam de contar e ele volta a ter ${limit} disponíveis. O limite continua valendo depois disso.`
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch("/api/carousel-agent/usage/reset", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao zerar o limite");
      toast.success(`Limite zerado: ${limit} imagens disponíveis`);
      startRefresh(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao zerar o limite");
    } finally {
      setBusy(false);
    }
  }

  const pending = busy || refreshing;
  return (
    <Button size="xs" variant="outline" onClick={reset} disabled={pending || used === 0}>
      {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
      Zerar limite
    </Button>
  );
}
