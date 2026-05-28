"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Brain, Loader2 } from "lucide-react";
import {
  BRAIN_GENERATION_MESSAGES,
  pickRandomBrainMessage,
} from "@/lib/constants/brain-generation-messages";

type CreativeBrainGeneratingModalProps = {
  open: boolean;
};

export function CreativeBrainGeneratingModal({
  open,
}: CreativeBrainGeneratingModalProps) {
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState(() => pickRandomBrainMessage());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    setMessage(pickRandomBrainMessage());
    const interval = setInterval(() => {
      setMessage((prev) => {
        const pool = BRAIN_GENERATION_MESSAGES.filter((m) => m !== prev);
        const next = pool[Math.floor(Math.random() * pool.length)];
        return next ?? pickRandomBrainMessage();
      });
    }, 2800);

    return () => clearInterval(interval);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/75 p-6 backdrop-blur-md animate-in-soft"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brain-gen-title"
      aria-busy="true"
    >
      <div className="surface-panel-elevated w-full max-w-md space-y-8 p-8 text-center shadow-2xl">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-border/50 bg-muted/30">
          <Brain className="size-8 text-foreground/90" strokeWidth={1.25} />
        </div>

        <div className="space-y-3">
          <h2
            id="brain-gen-title"
            className="text-lg font-medium tracking-heading text-foreground"
          >
            Gerando Creative Brain
          </h2>
          <p
            key={message}
            className="min-h-[3rem] text-sm leading-relaxed text-muted-foreground animate-in-soft"
          >
            {message}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Claude está processando o Brand DNA</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
