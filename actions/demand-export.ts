"use server";

import { revalidatePath } from "next/cache";
import pLimit from "p-limit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildExportFilename,
  demandExportTitle,
  type ExportFormat,
} from "@/lib/export/filename";
import {
  collectDemandDriveUrls,
  resolveDemandDriveFolder,
} from "@/lib/export/drive-folder";
import {
  findOrCreateFolder,
  getGoogleDriveAuth,
  uploadOrReplaceFile,
} from "@/lib/google/drive";
import { parseArtes } from "@/services/demands";
import type { DemandExportFile, DemandExportReport } from "@/types/demand-export";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const BUCKET = "demand-exports";

export type DemandExportActionState = {
  error?: string;
  success?: boolean;
  file?: DemandExportFile;
  report?: DemandExportReport;
};

export type DemandExportUploadTarget = {
  signedUrl: string;
  token: string;
  storagePath: string;
  filename: string;
  publicUrl: string;
};

export type DemandExportUploadTargetState = {
  error?: string;
  target?: DemandExportUploadTarget;
};

function isExportFormat(value: unknown): value is ExportFormat {
  return value === "feed" || value === "story";
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" as const, supabase };
  return { user, supabase };
}

/**
 * Resolve o nome de arquivo determinístico de um slot de entrega (título +
 * cliente + formato + índice) a partir da demanda. Compartilhado entre a criação
 * da URL assinada e o registro do metadado para que os dois cheguem exatamente ao
 * mesmo `storage_path` — o cliente nunca escolhe o caminho.
 */
async function resolveExportFilename(params: {
  demandId: string;
  artIndex: number;
  format: ExportFormat;
  fileName?: string;
  mimeType?: string;
}): Promise<{ filename: string; storagePath: string } | { error: string }> {
  const admin = createAdminClient();
  const { data: demand, error } = await admin
    .from("creative_demands")
    .select("id, tipo, briefing, client_name_external, clients(name, slug)")
    .eq("id", params.demandId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!demand) return { error: "Demanda não encontrada" };

  const briefing = (demand.briefing ?? {}) as { titulo?: string };
  const clients = demand.clients as
    | { name?: string; slug?: string }
    | { name?: string; slug?: string }[]
    | null;
  const client = Array.isArray(clients) ? clients[0] : clients;
  const filename = buildExportFilename({
    demandTitle: demandExportTitle({
      briefingTitle: briefing.titulo,
      tipo: demand.tipo,
    }),
    clientName: client?.name || demand.client_name_external,
    clientSlug: client?.slug,
    format: params.format,
    index: params.artIndex,
    fileName: params.fileName,
    mimeType: params.mimeType,
  });

  return { filename, storagePath: `${params.demandId}/${filename}` };
}

/**
 * Emite uma URL assinada para o navegador subir a arte DIRETO no Supabase Storage,
 * sem passar os bytes pela Server Action. Isso contorna o limite de corpo de
 * requisição do Vercel (~4.5MB), que silenciosamente descartava as artes maiores —
 * tipicamente os stories 9:16, que costumam pesar mais que o feed. Depois do upload
 * o cliente chama `recordDemandExportFileAction` para gravar o metadado.
 */
export async function createDemandExportUploadTargetAction(params: {
  demandId: string;
  artIndex: number;
  format: string;
  fileName: string;
  mimeType: string;
}): Promise<DemandExportUploadTargetState> {
  const auth = await requireUser();
  if ("error" in auth && !("user" in auth)) return { error: auth.error };

  if (!isExportFormat(params.format)) return { error: "Slot inválido" };
  if (!Number.isInteger(params.artIndex) || params.artIndex < 1) {
    return { error: "Slot inválido" };
  }
  if (!ALLOWED_TYPES.includes(params.mimeType)) {
    return { error: `Formato não suportado: ${params.fileName}` };
  }

  const resolved = await resolveExportFilename({
    demandId: params.demandId,
    artIndex: params.artIndex,
    format: params.format,
    fileName: params.fileName,
    mimeType: params.mimeType,
  });
  if ("error" in resolved) return { error: resolved.error };

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(resolved.storagePath, { upsert: true });

  if (error || !data) {
    return { error: error?.message ?? "Não foi possível preparar o upload" };
  }

  const { data: publicUrl } = admin.storage
    .from(BUCKET)
    .getPublicUrl(resolved.storagePath);

  return {
    target: {
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath: resolved.storagePath,
      filename: resolved.filename,
      publicUrl: publicUrl.publicUrl,
    },
  };
}

/**
 * Registra o metadado de uma arte já enviada ao Storage (via URL assinada). O
 * corpo é pequeno (só metadado), então não esbarra no limite de corpo do Vercel.
 * Recalcula o `storage_path` no servidor em vez de confiar no que o cliente manda.
 */
export async function recordDemandExportFileAction(params: {
  demandId: string;
  artIndex: number;
  format: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<DemandExportActionState> {
  const auth = await requireUser();
  if ("error" in auth && !("user" in auth)) return { error: auth.error };

  if (!isExportFormat(params.format)) return { error: "Slot inválido" };
  if (!Number.isInteger(params.artIndex) || params.artIndex < 1) {
    return { error: "Slot inválido" };
  }
  if (params.fileSize > MAX_FILE_SIZE) {
    return { error: `${params.fileName} passa de 10MB` };
  }

  const resolved = await resolveExportFilename({
    demandId: params.demandId,
    artIndex: params.artIndex,
    format: params.format,
    fileName: params.fileName,
    mimeType: params.mimeType,
  });
  if ("error" in resolved) return { error: resolved.error };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("demand_export_files")
    .select("id, storage_path")
    .eq("demand_id", params.demandId)
    .eq("art_index", params.artIndex)
    .eq("format", params.format)
    .maybeSingle();

  if (existing?.storage_path && existing.storage_path !== resolved.storagePath) {
    await admin.storage.from(BUCKET).remove([existing.storage_path]);
  }

  const { data: publicUrl } = admin.storage
    .from(BUCKET)
    .getPublicUrl(resolved.storagePath);

  const row = {
    demand_id: params.demandId,
    art_index: params.artIndex,
    format: params.format,
    filename: resolved.filename,
    storage_path: resolved.storagePath,
    public_url: publicUrl.publicUrl,
    mime_type: params.mimeType,
    file_size: params.fileSize,
    drive_file_id: null,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error: saveError } = await admin
    .from("demand_export_files")
    .upsert(row, { onConflict: "demand_id,art_index,format" })
    .select("*")
    .single();

  if (saveError) return { error: saveError.message };

  await admin
    .from("creative_demands")
    .update({
      export_status: "pending",
      export_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.demandId);

  revalidatePath(`/demands/${params.demandId}`);
  return { success: true, file: saved as DemandExportFile };
}

export async function deleteDemandExportFileAction(
  demandId: string,
  fileId: string
): Promise<DemandExportActionState> {
  const auth = await requireUser();
  if ("error" in auth && !("user" in auth)) return { error: auth.error };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("demand_export_files")
    .select("id, storage_path")
    .eq("id", fileId)
    .eq("demand_id", demandId)
    .maybeSingle();

  if (!existing) return { error: "Arquivo não encontrado" };

  await admin.storage.from(BUCKET).remove([existing.storage_path]);
  const { error } = await admin.from("demand_export_files").delete().eq("id", fileId);
  if (error) return { error: error.message };

  revalidatePath(`/demands/${demandId}`);
  return { success: true };
}

export async function deliverDemandExportAction(
  demandId: string,
  overrideFolderUrl?: string
): Promise<DemandExportActionState> {
  const auth = await requireUser();
  if ("error" in auth && !("user" in auth)) return { error: auth.error };

  const admin = createAdminClient();
  const { data: demand, error: demandError } = await admin
    .from("creative_demands")
    .select(
      "id, tipo, briefing, artes, drive_folder_id, drive_folder_url, client_name_external, clients(name, slug)"
    )
    .eq("id", demandId)
    .maybeSingle();

  if (demandError) return { error: demandError.message };
  if (!demand) return { error: "Demanda não encontrada" };

  const { data: files, error: filesError } = await admin
    .from("demand_export_files")
    .select("*")
    .eq("demand_id", demandId)
    .order("art_index", { ascending: true });

  if (filesError) return { error: filesError.message };
  if (!files?.length) {
    return { error: "Envie ao menos uma arte antes de entregar." };
  }

  const artes = parseArtes(demand.artes);
  const briefing = (demand.briefing ?? {}) as {
    driveMateriais?: string;
    materiaisEditados?: string;
  };
  const folder = resolveDemandDriveFolder(
    collectDemandDriveUrls({
      storedUrl: overrideFolderUrl || demand.drive_folder_url,
      briefing,
      artes,
    })
  );
  const folderId = demand.drive_folder_id || folder.id;

  await admin
    .from("creative_demands")
    .update({
      export_status: "running",
      export_error: null,
      drive_folder_url: folder.url ?? demand.drive_folder_url,
      drive_folder_id: folderId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", demandId);

  const driveAuth = await getGoogleDriveAuth();
  if (!driveAuth.canUpload) {
    await admin
      .from("creative_demands")
      .update({
        export_status: "done",
        exported_at: new Date().toISOString(),
        export_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", demandId);

    revalidatePath(`/demands/${demandId}`);
    return {
      success: true,
      report: {
        uploaded: files.length,
        sent: 0,
        failed: [],
        driveSkipped:
          "Arquivos salvos no CreativeOS. Conecte sua conta Google no botão Entregar demanda para enviar ao Drive.",
      },
    };
  }

  if (!folderId) {
    const message =
      "Pasta do Drive não encontrada nesta demanda. Confira o link de Drive no briefing.";
    await admin
      .from("creative_demands")
      .update({
        export_status: "error",
        export_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", demandId);
    return { error: message };
  }

  let storiesFolderId = folderId;
  try {
    storiesFolderId = await findOrCreateFolder(folderId, "Stories");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao criar a pasta Stories no Drive";
    await admin
      .from("creative_demands")
      .update({
        export_status: "error",
        export_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", demandId);
    return { error: message };
  }

  const limit = pLimit(3);
  const failed: DemandExportReport["failed"] = [];
  // Arquivos que já têm drive_file_id já foram entregues (e já tiveram a
  // cópia no Storage apagada abaixo) — reenviar de novo baixaria um arquivo
  // que não existe mais. Só o que ainda não foi entregue precisa do ciclo
  // download → upload no Drive → apagar do Storage.
  const alreadyDelivered = files.filter((file) => file.drive_file_id);
  const pending = files.filter((file) => !file.drive_file_id);
  let sent = alreadyDelivered.length;

  await Promise.all(
    pending.map((file) =>
      limit(async () => {
        try {
          const { data, error } = await admin.storage.from(BUCKET).download(file.storage_path);
          if (error || !data) {
            throw new Error(error?.message ?? "Não foi possível ler o arquivo");
          }
          const bytes = Buffer.from(await data.arrayBuffer());
          const parentId = file.format === "story" ? storiesFolderId : folderId;
          const driveFileId = await uploadOrReplaceFile({
            folderId: parentId,
            name: file.filename,
            bytes,
            mimeType: file.mime_type || "image/png",
          });
          await admin
            .from("demand_export_files")
            .update({
              drive_file_id: driveFileId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", file.id);
          // A arte já está no Drive do cliente — não precisa mais ocupar o
          // Storage do Supabase também (era isso que estourava o limite).
          await admin.storage.from(BUCKET).remove([file.storage_path]);
          sent += 1;
        } catch (error) {
          failed.push({
            filename: file.filename,
            error: error instanceof Error ? error.message : "Falha no envio",
          });
        }
      })
    )
  );

  const status = failed.length === 0 ? "done" : sent > 0 ? "error" : "error";
  const errorMessage =
    failed.length === 0
      ? null
      : `${failed.length} arquivo(s) falharam no Drive`;

  await admin
    .from("creative_demands")
    .update({
      export_status: status,
      export_error: errorMessage,
      exported_at: sent > 0 ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", demandId);

  revalidatePath(`/demands/${demandId}`);
  return {
    success: failed.length === 0,
    error: errorMessage ?? undefined,
    report: {
      uploaded: files.length,
      sent,
      failed,
    },
  };
}
