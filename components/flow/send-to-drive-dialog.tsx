"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, FolderUp, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  listRecentDemandsForDriveAction,
  sendArtToDemandSlotAction,
  type DriveTargetDemand,
} from "@/actions/demand-export";
import { slotsFromDemandArtes } from "@/lib/export/art-source";
import type { ExportFormat } from "@/lib/export/filename";
import { cn } from "@/lib/utils";

type Props = {
  sourceUrl: string;
  onClose: () => void;
};

const FORMAT_LABEL: Record<ExportFormat, string> = { feed: "Feed", story: "Stories" };

export function SendToDriveDialog({ sourceUrl, onClose }: Props) {
  const [demands, setDemands] = useState<DriveTargetDemand[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<DriveTargetDemand | null>(null);
  const [isSending, startSending] = useTransition();
  const [sentSlot, setSentSlot] = useState<string | null>(null);

  useEffect(() => {
    listRecentDemandsForDriveAction().then((res) => {
      if (res.error) setLoadError(res.error);
      else setDemands(res.demands ?? []);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!demands) return [];
    const q = query.trim().toLowerCase();
    if (!q) return demands.slice(0, 40);
    return demands
      .filter((d) => `${d.title} ${d.clientName}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [demands, query]);

  const slots = picked ? slotsFromDemandArtes(picked.artes) : [];

  function sendTo(artIndex: number, format: ExportFormat) {
    if (!picked) return;
    const key = `${artIndex}-${format}`;
    startSending(async () => {
      const result = await sendArtToDemandSlotAction({
        targetDemandId: picked.id,
        artIndex,
        format,
        sourceUrl,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSentSlot(key);
      toast.success(`Enviada para ${picked.title} — Arte ${artIndex} (${FORMAT_LABEL[format]})`);
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[var(--surface-shadow-elevated),var(--inner-highlight)]">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
          {picked ? (
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => { setPicked(null); setSentSlot(null); }}>
              <ChevronLeft />
            </Button>
          ) : (
            <FolderUp className="size-4 text-muted-foreground" />
          )}
          <h2 className="flex-1 truncate text-sm font-semibold text-foreground">
            {picked ? picked.title : "Enviar para o Drive de outra demanda"}
          </h2>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} title="Fechar">
            <X />
          </Button>
        </div>

        {!picked ? (
          <>
            <div className="border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-input px-2.5">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar demanda ou cliente…"
                  className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {loadError ? (
                <p className="p-3 text-sm text-tone-red">{loadError}</p>
              ) : demands === null ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Nenhuma demanda encontrada.</p>
              ) : (
                filtered.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setPicked(d)}
                    className="flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left transition-premium hover:bg-accent"
                  >
                    <span className="truncate text-sm font-medium text-foreground">{d.title}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {d.clientName} · {d.artes.length} art{d.artes.length === 1 ? "e" : "es"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {slots.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                Esta demanda ainda não tem artes no briefing.
              </p>
            ) : (
              slots.map((slot) => (
                <div key={slot.artIndex} className="rounded-xl border border-border p-3">
                  <p className="mb-2 text-sm font-medium text-foreground">
                    Arte {slot.artIndex}
                    {slot.title && slot.title !== `Arte ${slot.artIndex}` ? (
                      <span className="ml-1.5 text-xs text-muted-foreground">{slot.title}</span>
                    ) : null}
                  </p>
                  <div className="flex gap-2">
                    {slot.formats.map((format) => {
                      const key = `${slot.artIndex}-${format}`;
                      const justSent = sentSlot === key;
                      return (
                        <Button
                          key={format}
                          type="button"
                          variant={justSent ? "positive" : "outline"}
                          size="sm"
                          disabled={isSending}
                          onClick={() => sendTo(slot.artIndex, format)}
                          className={cn("flex-1", justSent && "pointer-events-none")}
                        >
                          {isSending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                          {justSent ? "Enviada ✓" : FORMAT_LABEL[format]}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            <p className="px-1 pt-1 text-xs text-muted-foreground">
              Preenche o slot de entrega dessa demanda — abra &quot;Entregar demanda&quot; nela
              para revisar e enviar ao Drive.
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
