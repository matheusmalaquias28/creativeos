"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  demandId: string;
  disabled?: boolean;
};

export function GenerateArtsButton({ demandId, disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/art-gen/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demandId }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        jobsCreated?: number;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Erro ao gerar artes");
        return;
      }

      // Navega imediatamente — o progresso aparece via Realtime na página de curadoria
      router.push(`/demands/${demandId}/curation`);
    } catch {
      toast.error("Erro ao iniciar geração");
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={() => void handleGenerate()}
      disabled={disabled || loading}
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Wand2 className="size-4" />
      )}
      {loading ? "Enfileirando..." : "Gerar artes"}
    </Button>
  );
}
