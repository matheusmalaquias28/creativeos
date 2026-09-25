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
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { Button } from "@/components/ui/button";
import {
  createDemandExportUploadTargetAction,
  deleteDemandExportFileAction,
  deliverDemandExportAction,
  recordDemandExportFileAction,
} from "@/actions/demand-export";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { disconnectGoogleDriveAction } from "@/actions/google-drive";
import { slotsFromDemandArtes } from "@/lib/export/art-source";
import {
  buildExportFilename,
  demandExportTitle,
  type ExportFormat,
} from "@/lib/export/filename";
import type { DemandArte } from "@/types/demand";
import type { DemandExportFile, GoogleDriveAuth } from "@/types/demand-export";
import { tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

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
  driveAuth: GoogleDriveAuth;
};

const EXPORT_BUCKET = "demand-exports";

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
  driveAuth,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState(initialFiles);
  const [folderUrl, setFolderUrl] = useState(driveFolderUrl ?? "");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [isDelivering, startDeliver] = useTransition();

  const [isDisconnecting, startDisconnect] = useTransition();
  const driveConfigured = driveAuth.canUpload;

  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("drive_connected") === "1") {
      toast.success("Google Drive conectado");
      params.delete("drive_connected");
      const next = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
      setOpen(true);
    }
    const error = params.get("drive_error");
    if (error) {
      toast.error("Não foi possível conectar o Google Drive");
      params.delete("drive_error");
      const next = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, []);

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
      // O arquivo sobe DIRETO no Storage via URL assinada; a Server Action só
      // troca metadado. Isso evita o limite de corpo de requisição do Vercel
      // (~4.5MB) que descartava silenciosamente os stories maiores.
      const targetState = await createDemandExportUploadTargetAction({
        demandId,
        artIndex,
        format,
        fileName: file.name,
        mimeType: file.type,
      });
      if (targetState.error || !targetState.target) {
        toast.error(targetState.error ?? "Falha ao preparar o upload");
        return;
      }

      const supabase = createBrowserSupabase();
      const { error: uploadError } = await supabase.storage
        .from(EXPORT_BUCKET)
        .uploadToSignedUrl(
          targetState.target.storagePath,
          targetState.target.token,
          file,
          { contentType: file.type }
        );
      if (uploadError) {
        toast.error(`Falha no upload: ${uploadError.message}`);
        return;
      }

      const result = await recordDemandExportFileAction({
        demandId,
        artIndex,
        format,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });
      if (result.error || !result.file) {
        toast.error(result.error ?? "Falha ao salvar a arte");
        return;
      }
      setFiles((prev) => {
        const without = prev.filter(
          (item) => !(item.art_index === artIndex && item.format === format)
        );
        return [...without, result.file!];
      });
      toast.success(`Salvo como ${result.file.filename}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha inesperada no upload"
      );
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
        variant="highlight"
        className="gap-2"
      >
        <PackageCheck className="size-4" />
        Entregar demanda
        {exportStatus === "done" ? (
          <span className="rounded-full bg-highlight-foreground/15 px-1.5 text-[0.6875rem] font-semibold">
            {sent > 0 ? `${sent} no Drive` : "salva"}
          </span>
        ) : null}
      </Button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-background/60 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              />
              <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[var(--surface-shadow-elevated),var(--inner-highlight)]">
                <div className="border-b border-border px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tones.green.iconTile)}>
                        <PackageCheck className="size-4" />
                      </span>
                      <div>
                      <h2 className="text-lg font-semibold tracking-tight text-foreground">
                        Entregar demanda
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Solte o feed e o stories de cada arte. Os arquivos são
                        renomeados no padrão do quadro.
                      </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setOpen(false)}
                      title="Fechar"
                    >
                      <X />
                      <span className="sr-only">Fechar</span>
                    </Button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-border bg-muted px-2.5 py-1 font-semibold tabular-nums text-foreground">
                      {uploaded}/{expected} arquivos
                    </span>
                    {driveFolderId ? (
                      <a
                        href={driveFolderUrl ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition-premium hover:brightness-110", tones.green.badge)}
                      >
                        <FolderOpen className="size-3.5" />
                        Pasta do Drive pronta
                      </a>
                    ) : missingFolder ? (
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium", tones.amber.badge)}>
                        <AlertTriangle className="size-3.5" />
                        Link do Drive sem pasta válida
                      </span>
                    ) : (
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium", tones.amber.badge)}>
                        <AlertTriangle className="size-3.5" />
                        Sem pasta do Drive nesta demanda
                      </span>
                    )}
                    {driveAuth.connected && driveAuth.email ? (
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium", tones.green.badge)}>
                        Drive: {driveAuth.email}
                        <button
                          type="button"
                          disabled={isDisconnecting}
                          onClick={() =>
                            startDisconnect(async () => {
                              const result = await disconnectGoogleDriveAction();
                              if (result.error) {
                                toast.error(result.error);
                                return;
                              }
                              toast.success("Google Drive desconectado");
                              router.refresh();
                            })
                          }
                          className="text-[0.6875rem] font-semibold underline-offset-2 hover:underline"
                        >
                          sair
                        </button>
                      </span>
                    ) : driveAuth.oauthAppConfigured ? (
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = `/api/google/drive/oauth?returnTo=${encodeURIComponent(
                            window.location.pathname
                          )}`;
                        }}
                        className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold transition-premium hover:brightness-110", tones.blue.badge)}
                      >
                        Conectar Google Drive
                      </button>
                    ) : (
                      <span className="text-muted-foreground">
                        Falta GOOGLE_OAUTH_CLIENT_ID no Vercel para conectar sua conta.
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
                          className="h-8 w-full rounded-lg border border-border bg-input px-2.5 text-xs text-foreground outline-none transition-premium placeholder:text-muted-foreground/70 hover:border-border-strong focus:border-primary/60 focus:ring-2 focus:ring-ring/20"
                        />
                      </label>
                    ) : null}
                    {exportError ? (
                      <span className="font-medium text-tone-amber">{exportError}</span>
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
                        className="rounded-2xl border border-border bg-surface/50 p-4"
                      >
                        <div className="mb-3">
                          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-muted-foreground">
                            Arte {slot.artIndex}
                          </span>
                          <h3 className="mt-1.5 text-sm font-semibold text-foreground">
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
                                  <p className="text-[0.8125rem] font-semibold text-foreground">
                                    {meta.label}{" "}
                                    <span className="text-muted-foreground">
                                      {meta.hint}
                                    </span>
                                  </p>
                                  {current ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRemove(current)}
                                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-premium hover:bg-accent hover:text-foreground"
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
                                  {current?.drive_file_id ? (
                                    // Já foi pro Drive do cliente — a cópia no Storage
                                    // foi apagada (não faz sentido guardar em 2 lugares),
                                    // então não tem mais o que mostrar como preview aqui.
                                    <div
                                      className={cn(
                                        "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-tone-green/25 bg-tone-green/8 text-center",
                                        meta.preview
                                      )}
                                    >
                                      <Check className="size-5 text-tone-green" />
                                      <p className="px-3 text-xs font-medium text-tone-green">
                                        Entregue no Drive
                                      </p>
                                    </div>
                                  ) : current ? (
                                    <div
                                      className={cn(
                                        "overflow-hidden rounded-xl border border-border bg-muted",
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
                                        "flex items-center justify-center rounded-xl border border-dashed border-border-strong px-3 text-center text-xs text-muted-foreground",
                                        meta.preview
                                      )}
                                    >
                                      Solte a arte {meta.label.toLowerCase()} · até 10MB
                                    </div>
                                  )}
                                </ImageDropzone>
                                <p className="truncate font-mono text-[0.6875rem] text-muted-foreground">
                                  {current?.filename ??
                                    previewName(slot.artIndex, format)}
                                  {current?.drive_file_id ? (
                                    <span className="ml-1.5 inline-flex items-center gap-0.5 font-sans font-semibold text-tone-green">
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

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/60 px-6 py-4">
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
