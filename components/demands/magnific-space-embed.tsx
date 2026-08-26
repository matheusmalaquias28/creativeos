"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MagnificSpaceNode } from "@/types/demand";

const SPACE_NODE_TYPE_LABELS: Record<string, string> = {
  "image-generator": "Geração",
  image: "Imagem",
  text: "Texto",
  video: "Vídeo",
};

type Props = {
  spaceUrl: string;
  nodes?: MagnificSpaceNode[];
};

export function MagnificSpaceEmbed({ spaceUrl, nodes = [] }: Props) {
  const [iframeKey, setIframeKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const reload = useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!fullscreen) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  const frame = (
    <iframe
      key={iframeKey}
      src={spaceUrl}
      title="Magnific Space"
      className="size-full border-0 bg-black/40"
      allow="clipboard-read; clipboard-write; fullscreen"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Board do Magnific nesta demanda. Precisa estar logado no Magnific neste navegador.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="ghost" size="xs" onClick={reload}>
            <RefreshCw />
            Recarregar
          </Button>
          <Button type="button" variant="ghost" size="xs" onClick={() => setFullscreen(true)}>
            <Maximize2 />
            Tela cheia
          </Button>
          <a
            href={spaceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          >
            <ExternalLink className="size-3" />
            Abrir fora
          </a>
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden border border-white/8 bg-black/30",
          fullscreen
            ? "fixed inset-0 z-50 rounded-none"
            : "h-[min(78vh,880px)] rounded-xl"
        )}
      >
        {fullscreen && (
          <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-background px-4 py-2">
            <span className="text-sm font-medium">Magnific Space</span>
            <div className="flex items-center gap-1.5">
              <Button type="button" variant="ghost" size="xs" onClick={reload}>
                <RefreshCw />
                Recarregar
              </Button>
              <Button type="button" variant="outline" size="xs" onClick={() => setFullscreen(false)}>
                <Minimize2 />
                Fechar
              </Button>
            </div>
          </div>
        )}
        <div className={cn("w-full", fullscreen ? "h-[calc(100%-41px)]" : "h-full")}>{frame}</div>
      </div>

      {nodes.length > 0 && !fullscreen && (
        <ul className="flex flex-wrap gap-2">
          {nodes.map((node) => (
            <li
              key={node.id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-foreground/80"
            >
              <span className="text-muted-foreground">
                {SPACE_NODE_TYPE_LABELS[node.type] ?? node.type}
              </span>
              {node.name && <span className="font-medium">{node.name}</span>}
            </li>
          ))}
        </ul>
      )}

      {!fullscreen && (
        <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
          Se o board aparecer em branco, o Magnific está bloqueando o embed. Use tela cheia
          ou abra fora — o ajuste no canvas continua sendo o do Spaces.
        </p>
      )}
    </div>
  );
}
