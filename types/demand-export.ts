import type { ExportFormat } from "@/lib/export/filename";

export type DemandExportStatus = "pending" | "running" | "done" | "error";

export type DemandExportFile = {
  id: string;
  demand_id: string;
  art_index: number;
  format: ExportFormat;
  filename: string;
  storage_path: string;
  public_url: string;
  mime_type: string | null;
  file_size: number | null;
  drive_file_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DemandExportReport = {
  uploaded: number;
  sent: number;
  failed: Array<{ filename: string; error: string }>;
  driveSkipped?: string;
};

export type GoogleDriveAuth = {
  connected: boolean;
  email: string | null;
  oauthAppConfigured: boolean;
  saConfigured: boolean;
  canUpload: boolean;
};
