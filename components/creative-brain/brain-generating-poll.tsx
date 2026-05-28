"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncCreativeBrainGenerationAction } from "@/actions/creative-brain";
const POLL_INTERVAL_MS = 8_000;

type BrainGeneratingPollProps = {
  clientId: string;
  active: boolean;
};

/** Atualiza a página e expira gerações presas enquanto status = generating. */
export function BrainGeneratingPoll({
  clientId,
  active,
}: BrainGeneratingPollProps) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    const tick = async () => {
      await syncCreativeBrainGenerationAction(clientId);
      router.refresh();
    };

    void tick();
    const id = setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [active, clientId, router]);

  return null;
}
