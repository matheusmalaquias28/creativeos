"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioContext) sharedAudioContext = new AudioContext();
  return sharedAudioContext;
}

async function unlockAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") await ctx.resume();
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume = 0.3
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
    // Tom de "novo cliente" — três notas ascendentes
    playTone(ctx, 660, now, 0.15);
    playTone(ctx, 880, now + 0.18, 0.15);
    playTone(ctx, 1100, now + 0.36, 0.2);
  } catch {
    // contexto de áudio bloqueado pelo navegador
  }
}

export function ClientsRealtimeListener() {
  const router = useRouter();
  const initialized = useRef(false);

  useEffect(() => {
    const unlock = () => void unlockAudioContext();
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
      .channel("clients-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "clients" },
        (payload) => {
          const client = payload.new as Record<string, unknown>;
          const info = client.company_info as Record<string, unknown> | undefined;
          const isFromWebhook = info?.source === "webhook";

          // Só notifica clientes criados via webhook para evitar ruído
          if (!isFromWebhook) return;

          void playNotificationSound();

          toast.info(`Novo cliente: ${client.name}`, {
            description: "Entrou na base via Make · Status: Onboarding",
            action: {
              label: "Ver",
              onClick: () => router.push(`/clients/${client.id}`),
            },
            duration: 10000,
          });

          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
