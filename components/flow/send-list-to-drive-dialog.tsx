"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { FolderUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NodeSelect } from "@/components/flow/nodes/node-select";
import {
  listRecentDemandsForDriveAction,
  resolveListDriveSlotsAction,
  sendListToDriveAction,
} from "@/actions/demand-export";
import type { ExportFormat } from "@/lib/export/filename";
import { cn } from "@/lib/utils";

type Props = {
  demandId: string;
  urls: string[];
  /** Formato pré-selecionado (lista de stories → "story"). */
  defaultFormat: ExportFormat;
  onClose: () => void;
};

const FORMAT_LABEL: Record<ExportFormat, string> = { feed: "Feed", story: "Stories" };
const SKIP = "skip";

/**
 * Envia as imagens de uma Lista do Space para o Drive da demanda: cada imagem
 * vai para o slot da sua arte (Arte N) no formato escolhido, e só esse formato
 * é entregue — stories caem na pasta "Stories". A arte de cada imagem vem da
 * origem registrada na geração; quando não dá para saber, o operador escolhe.
 */
export function SendListToDriveDialog({ demandId, urls, defaultFormat, onClose }: Props) {
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);
  const [artCount, setArtCount] = useState<number | null>(null);
  const [slots, setSlots] = useState<Record<string, number | null> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      resolveListDriveSlotsAction({ demandId, urls }),
      listRecentDemandsForDriveAction(demandId),
    ]).then(([resolved, demands]) => {
      if (resolved.error || demands.error) {
        setLoadError(resolved.error ?? demands.error ?? "Erro ao carregar");
        return;
      }
      const demand = demands.demands?.find((d) => d.id === demandId);
      setArtCount(demand?.artes.length ?? 0);
      setSlots(Object.fromEntries((resolved.slots ?? []).map((s) => [s.url, s.artIndex])));
    });
  }, [demandId, urls]);

  const assigned = useMemo(
    () =>
      urls
        .map((url) => ({ url, artIndex: slots?.[url] ?? null }))
        .filter((i): i is { url: string; artIndex: number } => i.artIndex !== null),
    [urls, slots]
  );
  const duplicated = useMemo(() => {
    const seen = new Set<number>();
    const dup = new Set<number>();
    for (const { artIndex } of assigned) (seen.has(artIndex) ? dup : seen).add(artIndex);
    return dup;
  }, [assigned]);

  const slotOptions = [
    { value: SKIP, label: "Não enviar" },
    ...Array.from({ length: artCount ?? 0 }, (_, i) => ({
      value: String(i + 1),
      label: `Arte ${i + 1}`,
    })),
  ];

  function send() {
    startSending(async () => {
      const res = await sendListToDriveAction({ demandId, format, items: assigned });
      if (res.error && !res.report) {
        toast.error(res.error);
        return;
      }
      const report = res.report;
      if (report?.driveSkipped) {
        setResult(report.driveSkipped);
        toast.message("Salvo nos slots da demanda", { description: report.driveSkipped });
        return;
      }
      if (report && report.failed.length > 0) {
        setResult(`${report.failed.length} falharam: ${report.failed[0].error}`);
        toast.error(res.error ?? "Algumas imagens falharam no Drive");
        return;
      }
      setResult(`${assigned.length} enviadas para a pasta ${format === "story" ? "Stories" : "da demanda"} no Drive.`);
      toast.success(`${assigned.length} ${assigned.length === 1 ? "imagem enviada" : "imagens enviadas"} ao Drive`);
    });
  }

  const ready = slots !== null && artCount !== null;
  const canSend = ready && assigned.length > 0 && duplicated.size === 0 && !isSending;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[var(--surface-shadow-elevated),var(--inner-highlight)]">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
          <FolderUp className="size-4 text-muted-foreground" />
          <h2 className="flex-1 truncate text-sm font-semibold text-foreground">
            Enviar lista para o Drive
          </h2>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} title="Fechar">
            <X />
          </Button>
        </div>

        <div className="flex gap-1 border-b border-border px-4 py-2.5">
          {(["story", "feed"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={cn(
                "flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-premium",
                format === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "story" ? "Pasta Stories" : "Pasta do Feed"}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
          {loadError ? (
            <p className="p-3 text-sm text-tone-red">{loadError}</p>
          ) : !ready ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            urls.map((url, i) => {
              const artIndex = slots?.[url] ?? null;
              return (
                <div
                  key={url}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-2",
                    artIndex !== null && duplicated.has(artIndex)
                      ? "border-tone-red/60"
                      : "border-border"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Item ${i + 1}`}
                    className="size-14 shrink-0 rounded-lg border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <NodeSelect
                      title="Arte da demanda"
                      value={artIndex === null ? SKIP : String(artIndex)}
                      options={slotOptions}
                      onChange={(v) =>
                        setSlots((s) => ({ ...s, [url]: v === SKIP ? null : Number(v) }))
                      }
                    />
                    {artIndex !== null && duplicated.has(artIndex) && (
                      <p className="mt-1 text-[0.6875rem] text-tone-red">
                        Outra imagem já vai para a Arte {artIndex}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-2 border-t border-border p-3">
          {result && <p className="text-xs text-muted-foreground">{result}</p>}
          <Button type="button" className="w-full" disabled={!canSend} onClick={send}>
            {isSending ? <Loader2 className="size-3.5 animate-spin" /> : <FolderUp className="size-3.5" />}
            Enviar {assigned.length} para {format === "story" ? "a pasta Stories" : "o Drive"}
          </Button>
          <p className="text-[0.6875rem] text-muted-foreground">
            Cada imagem substitui o {FORMAT_LABEL[format].toLowerCase()} da arte escolhida na
            entrega da demanda e sobe direto para o Drive.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
