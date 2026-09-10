import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { DemandExportFile } from "@/types/demand-export";
import type { ExportFormat } from "@/lib/export/filename";

export const getDemandExportFiles = cache(
  async (demandId: string): Promise<DemandExportFile[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("demand_export_files")
      .select("*")
      .eq("demand_id", demandId)
      .order("art_index", { ascending: true });

    if (error) {
      if (/demand_export_files|export_status|schema cache/i.test(error.message)) {
        return [];
      }
      throw new Error(error.message);
    }
    return (data ?? []) as DemandExportFile[];
  }
);

export function findExportFile(
  files: DemandExportFile[],
  artIndex: number,
  format: ExportFormat
): DemandExportFile | undefined {
  return files.find((file) => file.art_index === artIndex && file.format === format);
}
