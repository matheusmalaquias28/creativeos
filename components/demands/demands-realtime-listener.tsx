"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useNewDemandsCount } from "@/components/demands/new-demands-count-provider";

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContext();
  }

  return sharedAudioContext;
}

async function unlockAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    await ctx.resume();
  }
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume = 0.35
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

async function playNotificationSound() {
  try {
    await unlockAudioContext();
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    playTone(ctx, 880, now, 0.18);
    playTone(ctx, 1175, now + 0.2, 0.22);
  } catch {
    // contexto de áudio indisponível ou bloqueado pelo navegador
  }
}

export function DemandsRealtimeListener() {
  const router = useRouter();
  const { increment } = useNewDemandsCount();
  const initialized = useRef(false);

  useEffect(() => {
    const unlock = () => {
      void unlockAudioContext();
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const supabase = createClient();

    const channel = supabase
      .channel("demands-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "creative_demands",
        },
        (payload) => {
          const demand = payload.new as Record<string, unknown>;
          const briefing = demand.briefing as Record<string, unknown> | undefined;
          const title =
            (typeof briefing?.titulo === "string" && briefing.titulo) ||
            demand.client_name_external ||
            "Nova demanda";

          increment();
          void playNotificationSound();

          toast.info(`Nova demanda: ${title}`, {
            description: "Clique para ver",
            action: {
              label: "Ver",
              onClick: () => router.push(`/demands/${demand.id}`),
            },
            duration: 8000,
          });

          // Atualiza os dados do servidor para o Kanban e outras listas
          setTimeout(() => router.refresh(), 400);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "creative_demands",
        },
        () => {
          // Cobre o status do Magnific Space (generating → ready/failed) e outras
          // atualizações — sem toast/som, só re-busca os dados do servidor.
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, increment]);

  return null;
}
