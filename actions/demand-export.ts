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
  isGoogleDriveConfigured,
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

function parseFormat(value: FormDataEntryValue | null): ExportFormat | null {
  return value === "feed" || value === "story" ? value : null;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" as const, supabase };
  return { user, supabase };
}

export async function uploadDemandExportFileAction(
  demandId: string,
  formData: FormData
): Promise<DemandExportActionState> {
  const auth = await requireUser();
  if ("error" in auth && !("user" in auth)) return { error: auth.error };

  const format = parseFormat(formData.get("format"));
  const artIndex = Number(formData.get("artIndex"));
  const file = formData.get("file");

  if (!format || !Number.isInteger(artIndex) || artIndex < 1) {
    return { error: "Slot inválido" };
  }
  if (!(file instanceof File)) {
    return { error: "Selecione um arquivo" };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: `Formato não suportado: ${file.name}` };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: `${file.name} passa de 10MB` };
  }

  const { data: demand, error: demandError } = await auth.supabase
    .from("creative_demands")
    .select("id, tipo, briefing, client_name_external, clients(name, slug)")
    .eq("id", demandId)
    .maybeSingle();

  if (demandError) return { error: demandError.message };
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
    format,
    index: artIndex,
    fileName: file.name,
    mimeType: file.type,
  });

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("demand_export_files")
    .select("id, storage_path")
    .eq("demand_id", demandId)
    .eq("art_index", artIndex)
    .eq("format", format)
    .maybeSingle();

  const storagePath = `${demandId}/${filename}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { upsert: true, contentType: file.type });

  if (uploadError) return { error: uploadError.message };

  if (existing?.storage_path && existing.storage_path !== storagePath) {
    await admin.storage.from(BUCKET).remove([existing.storage_path]);
  }

  const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(storagePath);

  const row = {
    demand_id: demandId,
    art_index: artIndex,
    format,
    filename,
    storage_path: storagePath,
    public_url: publicUrl.publicUrl,
    mime_type: file.type,
    file_size: file.size,
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
    .eq("id", demandId);

  revalidatePath(`/demands/${demandId}`);
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

  if (!isGoogleDriveConfigured()) {
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
          "Arquivos salvos no CreativeOS. Configure GOOGLE_SA_EMAIL e GOOGLE_SA_PRIVATE_KEY para enviar ao Drive.",
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
  let sent = 0;

  await Promise.all(
    files.map((file) =>
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
