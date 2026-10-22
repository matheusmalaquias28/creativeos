"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * Mantém a aba Vídeos sincronizada: re-busca os dados do servidor quando uma
 * demanda de vídeo é criada (com toast) ou atualizada (mudança de status).
 */
export function VideoDemandsRealtimeListener() {
  const router = useRouter();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const supabase = createClient();

    const channel = supabase
      .channel("video-demands-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "video_demands" },
        (payload) => {
          const demand = payload.new as Record<string, unknown>;
          const briefing = demand.briefing as Record<string, unknown> | undefined;
          const title =
            (typeof briefing?.titulo === "string" && briefing.titulo) ||
            (typeof demand.client_name_external === "string" &&
              demand.client_name_external) ||
            "Nova demanda de vídeo";

          toast.info(`Novo vídeo: ${title}`, { duration: 8000 });
          setTimeout(() => router.refresh(), 400);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "video_demands" },
        () => {
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
