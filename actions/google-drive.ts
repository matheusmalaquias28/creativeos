"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { deleteGoogleDriveConnection } from "@/lib/google/oauth";

export async function disconnectGoogleDriveAction(): Promise<{ error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "Não autenticado" };
  await deleteGoogleDriveConnection();
  revalidatePath("/demands");
  return {};
}
