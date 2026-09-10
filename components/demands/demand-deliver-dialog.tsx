"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  FolderOpen,
  Loader2,
  PackageCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { Button } from "@/components/ui/button";
import {
  deleteDemandExportFileAction,
  deliverDemandExportAction,
  uploadDemandExportFileAction,
} from "@/actions/demand-export";
import { slotsFromDemandArtes } from "@/lib/export/art-source";
import {
  buildExportFilename,
  demandExportTitle,
  type ExportFormat,
} from "@/lib/export/filename";
import { cn } from "@/lib/utils";
import type { DemandArte } from "@/types/demand";
import type { DemandExportFile } from "@/types/demand-export";

type Props = {
  demandId: string;
  artes: DemandArte[];
  demandTitle: string;
  demandTipo: string | null;
  clientName: string;
  clientSlug?: string | null;
  driveFolderUrl: string | null;
  driveFolderId: string | null;
  exportStatus: string | null;
  exportError: string | null;
  initialFiles: DemandExportFile[];
  driveConfigured: boolean;
};

const FORMAT_META: Record<
  ExportFormat,
  { label: string; ratio: string; hint: string; preview: string }
> = {
  feed: {
    label: "Feed",
    ratio: "4:5",
    hint: "1:1 ou 4:5",
    preview: "mx-auto aspect-[4/5] max-h-64",
  },
  story: {
    label: "Stories",
    ratio: "9:16",
    hint: "9:16",
    preview: "mx-auto aspect-[9/16] max-h-64",
  },
};

export function DemandDeliverDialog({
  demandId,
  artes,
  demandTitle,
  demandTipo,
  clientName,
  clientSlug,
  driveFolderUrl,
  driveFolderId,
  exportStatus,
  exportError,
  initialFiles,
  driveConfigured,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState(initialFiles);
  const [folderUrl, setFolderUrl] = useState(driveFolderUrl ?? "");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [isDelivering, startDeliver] = useTransition();

  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  const slots = useMemo(() => slotsFromDemandArtes(artes), [artes]);
  const titleForName = demandExportTitle({
    briefingTitle: demandTitle,
    tipo: demandTipo,
  });
  const expected = slots.length * 2;
  const uploaded = files.length;
  const sent = files.filter((file) => file.drive_file_id).length;

  function fileFor(artIndex: number, format: ExportFormat) {
    return files.find((file) => file.art_index === artIndex && file.format === format);
  }

  function previewName(artIndex: number, format: ExportFormat, file?: File) {
    return buildExportFilename({
      demandTitle: titleForName,
      clientName,
      clientSlug,
      format,
      index: artIndex,
      fileName: file?.name,
      mimeType: file?.type,
    });
  }

  async function handleUpload(artIndex: number, format: ExportFormat, incoming: File[]) {
    const file = incoming[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`${file.name} passa de 10MB`);
      return;
    }
    const key = `${artIndex}-${format}`;
    setUploadingKey(key);
    try {
      const formData = new FormData();
      formData.set("artIndex", String(artIndex));
      formData.set("format", format);
      formData.set("file", file);
      const result = await uploadDemandExportFileAction(demandId, formData);
      if (result.error || !result.file) {
        toast.error(result.error ?? "Falha no upload");
        return;
      }
      setFiles((prev) => {
        const without = prev.filter(
          (item) => !(item.art_index === artIndex && item.format === format)
        );
        return [...without, result.file!];
      });
      toast.success(`Salvo como ${result.file.filename}`);
    } finally {
      setUploadingKey(null);
    }
  }

  async function handleRemove(file: DemandExportFile) {
    const result = await deleteDemandExportFileAction(demandId, file.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setFiles((prev) => prev.filter((item) => item.id !== file.id));
  }

  function handleDeliver() {
    startDeliver(async () => {
      const result = await deliverDemandExportAction(demandId, folderUrl.trim() || undefined);
      if (result.error && !result.report) {
        toast.error(result.error);
        return;
      }
      if (result.report?.driveSkipped) {
        toast.success("Artes salvas", { description: result.report.driveSkipped });
        router.refresh();
        return;
      }
      if (result.report && result.report.failed.length > 0) {
        toast.error(
          `${result.report.sent}/${result.report.uploaded} enviadas`,
          { description: result.report.failed[0]?.error }
        );
        return;
      }
      toast.success(
        result.report
          ? `${result.report.sent}/${result.report.uploaded} enviadas ao Drive`
          : "Demanda entregue"
      );
      router.refresh();
    });
  }

  const missingFolder = !driveFolderId && Boolean(driveFolderUrl);
  const noFolder = !driveFolderId;

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="gap-2 bg-emerald-500 text-emerald-950 shadow-[0_0_20px_rgba(16,185,129,0.28)] hover:bg-emerald-400 hover:opacity-100"
      >
        <PackageCheck className="size-4" />
        Entregar demanda
        {exportStatus === "done" ? (
          <span className="rounded-full bg-emerald-950/15 px-1.5 text-[10px] font-medium">
            {sent > 0 ? `${sent} no Drive` : "salva"}
          </span>
        ) : null}
      </Button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              />
              <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl dark:border-white/10 dark:bg-surface-elevated">
                <div className="border-b border-border/60 px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold tracking-tight">
                        Entregar demanda
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Solte o feed e o stories de cada arte. Os arquivos são
                        renomeados no padrão do quadro.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Fechar
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-border/70 px-2.5 py-1 text-muted-foreground">
                      {uploaded}/{expected} arquivos
                    </span>
                    {driveFolderId ? (
                      <a
                        href={driveFolderUrl ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300"
                      >
                        <FolderOpen className="size-3.5" />
                        Pasta do Drive pronta
                      </a>
                    ) : missingFolder ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-amber-300">
                        <AlertTriangle className="size-3.5" />
                        Link do Drive sem pasta válida
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-amber-300">
                        <AlertTriangle className="size-3.5" />
                        Sem pasta do Drive nesta demanda
                      </span>
                    )}
                    {!driveConfigured && (
                      <span className="text-muted-foreground">
                        Drive ainda não autenticado — as artes ficam salvas aqui.
                      </span>
                    )}
                    {!driveFolderId ? (
                      <label className="flex min-w-[16rem] flex-1 items-center gap-2">
                        <span className="whitespace-nowrap text-muted-foreground">
                          Pasta do Drive
                        </span>
                        <input
                          type="url"
                          value={folderUrl}
                          onChange={(event) => setFolderUrl(event.target.value)}
                          placeholder="Cole o link da pasta do cliente"
                          className="h-7 w-full rounded-md border border-border/70 bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground/60 focus:border-foreground/40"
                        />
                      </label>
                    ) : null}
                    {exportError ? (
                      <span className="text-amber-300">{exportError}</span>
                    ) : null}
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                  {slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Esta demanda ainda não tem artes no briefing.
                    </p>
                  ) : (
                    slots.map((slot) => (
                      <section
                        key={slot.artIndex}
                        className="rounded-2xl border border-border/60 p-4 dark:border-white/8"
                      >
                        <div className="mb-3">
                          <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                            Arte {slot.artIndex}
                          </p>
                          <h3 className="mt-1 text-sm font-medium text-foreground">
                            {slot.title}
                          </h3>
                          {slot.subheadline ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {slot.subheadline}
                            </p>
                          ) : null}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          {slot.formats.map((format) => {
                            const current = fileFor(slot.artIndex, format);
                            const meta = FORMAT_META[format];
                            const key = `${slot.artIndex}-${format}`;
                            return (
                              <div key={format} className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-medium">
                                    {meta.label}{" "}
                                    <span className="text-muted-foreground">
                                      {meta.hint}
                                    </span>
                                  </p>
                                  {current ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRemove(current)}
                                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                                    >
                                      <Trash2 className="size-3" />
                                      Trocar
                                    </button>
                                  ) : null}
                                </div>
                                <ImageDropzone
                                  title={`Enviar ${meta.label.toLowerCase()}`}
                                  subtitle={`Até 10MB · ${previewName(slot.artIndex, format)}`}
                                  accept="image/jpeg,image/png,image/webp"
                                  minHeight="sm"
                                  isUploading={uploadingKey === key}
                                  icon={
                                    <Upload className="size-5 text-muted-foreground/70" />
                                  }
                                  onFiles={(incoming) =>
                                    handleUpload(slot.artIndex, format, incoming)
                                  }
                                  className="p-0"
                                >
                                  {current ? (
                                    <div
                                      className={cn(
                                        "overflow-hidden rounded-xl border border-border/50 bg-black/20",
                                        meta.preview
                                      )}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={current.public_url}
                                        alt={current.filename}
                                        className="size-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div
                                      className={cn(
                                        "flex items-center justify-center rounded-xl border border-dashed border-border/50 text-xs text-muted-foreground",
                                        meta.preview
                                      )}
                                    >
                                      Solte a arte {meta.label.toLowerCase()} · até 10MB
                                    </div>
                                  )}
                                </ImageDropzone>
                                <p className="truncate font-mono text-[10px] text-muted-foreground">
                                  {current?.filename ??
                                    previewName(slot.artIndex, format)}
                                  {current?.drive_file_id ? (
                                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-emerald-400">
                                      <Check className="size-3" />
                                      Drive
                                    </span>
                                  ) : null}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-6 py-4">
                  <p className="text-xs text-muted-foreground">
                    Feed fica na pasta principal. Stories vão para a subpasta
                    Stories.
                    {noFolder
                      ? " Sem pasta de destino, a entrega fica só no CreativeOS."
                      : ""}
                  </p>
                  <Button
                    type="button"
                    onClick={handleDeliver}
                    disabled={uploaded === 0 || isDelivering}
                    className="gap-2"
                  >
                    {isDelivering ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <PackageCheck className="size-4" />
                    )}
                    {driveConfigured && driveFolderId
                      ? "Enviar ao Drive"
                      : "Salvar entrega"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
