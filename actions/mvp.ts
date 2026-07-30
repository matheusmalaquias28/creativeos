"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { extractDocxText } from "@/lib/mvp/parse-docx";
import { triggerMvpGeneration, triggerMvpOrganization } from "@/lib/mvp/trigger-generation";
import { MVP_MAX_REFERENCES, parseMvpPages, parseMvpReferences } from "@/types/mvp";

const MAX_DOCX_SIZE = 20 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

export type MvpActionState = {
  error?: string;
  success?: boolean;
};

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createMvpProjectAction(
  _prev: MvpActionState,
  formData: FormData
): Promise<MvpActionState> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Não autenticado" };

  const file = formData.get("docx");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Envie o .docx com o conteúdo do MVP" };
  }
  if (file.size > MAX_DOCX_SIZE) return { error: "Arquivo muito grande (máx. 20MB)" };
  if (file.type !== DOCX_MIME && !file.name.toLowerCase().endsWith(".docx")) {
    return { error: "O arquivo precisa ser um .docx" };
  }

  let rawContent: string;
  try {
    rawContent = await extractDocxText(Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao ler o .docx" };
  }

  const title =
    (formData.get("title") as string | null)?.trim() ||
    file.name.replace(/\.docx$/i, "").replace(/[_-]+/g, " ").trim();

  const { data: created, error } = await supabase
    .from("mvp_projects")
    .insert({
      user_id: user.id,
      title,
      docx_file_name: file.name,
      raw_content: rawContent,
      status: "organizing",
    })
    .select("id")
    .single();

  if (error || !created) return { error: error?.message ?? "Falha ao criar o projeto" };

  after(() => triggerMvpOrganization(created.id));

  redirect(`/mvp/${created.id}`);
}

export async function retryMvpOrganizationAction(projectId: string): Promise<MvpActionState> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: claimed, error } = await supabase
    .from("mvp_projects")
    .update({ status: "organizing", error: null, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", user.id)
    .neq("status", "organizing")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!claimed) return { error: "Organização já em andamento" };

  after(() => triggerMvpOrganization(projectId));
  return { success: true };
}

async function uploadImageToBucket(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string,
  file: File,
  prefix: string
): Promise<{ url?: string; error?: string }> {
  if (!IMAGE_TYPES.includes(file.type)) {
    return { error: `Formato não suportado: ${file.name}` };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { error: `Arquivo muito grande: ${file.name} (máx. 10MB)` };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${userId}/${projectId}/${prefix}-${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from("mvp-assets")
    .upload(storagePath, file, { upsert: false, contentType: file.type });
  if (error) return { error: error.message };

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return { url: `${baseUrl}/storage/v1/object/public/mvp-assets/${storagePath}` };
}

export async function uploadMvpLogoAction(
  projectId: string,
  _prev: MvpActionState,
  formData: FormData
): Promise<MvpActionState> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Não autenticado" };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione a logo" };

  const uploaded = await uploadImageToBucket(supabase, user.id, projectId, file, "logo");
  if (uploaded.error || !uploaded.url) return { error: uploaded.error };

  const { error } = await supabase
    .from("mvp_projects")
    .update({ logo_url: uploaded.url, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/mvp/${projectId}`);
  return { success: true };
}

export async function uploadMvpReferencesAction(
  projectId: string,
  _prev: MvpActionState,
  formData: FormData
): Promise<MvpActionState> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Não autenticado" };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Selecione ao menos uma imagem" };

  const { data: project, error: fetchError } = await supabase
    .from("mvp_projects")
    .select("reference_urls")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();
  if (fetchError || !project) return { error: "Projeto não encontrado" };

  const references = parseMvpReferences(project.reference_urls);
  if (references.length + files.length > MVP_MAX_REFERENCES) {
    return {
      error: `Máximo de ${MVP_MAX_REFERENCES} referências por MVP (você já tem ${references.length})`,
    };
  }

  for (const file of files) {
    const uploaded = await uploadImageToBucket(supabase, user.id, projectId, file, "ref");
    if (uploaded.error || !uploaded.url) return { error: uploaded.error };
    references.push({ url: uploaded.url, fileName: file.name });
  }

  const { error } = await supabase
    .from("mvp_projects")
    .update({ reference_urls: references, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/mvp/${projectId}`);
  return { success: true };
}

export async function removeMvpReferenceAction(
  projectId: string,
  url: string
): Promise<MvpActionState> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: project } = await supabase
    .from("mvp_projects")
    .select("reference_urls")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();
  if (!project) return { error: "Projeto não encontrado" };

  const references = parseMvpReferences(project.reference_urls).filter((r) => r.url !== url);

  const { error } = await supabase
    .from("mvp_projects")
    .update({ reference_urls: references, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/mvp/${projectId}`);
  return { success: true };
}

export async function generateMvpAction(projectId: string): Promise<MvpActionState> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: project } = await supabase
    .from("mvp_projects")
    .select("id, status, pages")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();
  if (!project) return { error: "Projeto não encontrado" };
  if (parseMvpPages(project.pages).length === 0) {
    return { error: "O conteúdo ainda não foi organizado em páginas" };
  }

  // Regenerar um MVP já pronto recomeça do lote 1 em um Space novo; retomar
  // após falha/pausa mantém o Space e os lotes já gerados.
  const restartFields =
    project.status === "ready"
      ? { generated_batches: 0, space_id: null, space_url: null, space_nodes: null }
      : {};

  // Update condicional evita corrida em cliques duplicados: só um request
  // transiciona o status; o outro recebe zero linhas.
  const { data: claimed, error } = await supabase
    .from("mvp_projects")
    .update({
      status: "generating",
      requested_at: new Date().toISOString(),
      error: null,
      updated_at: new Date().toISOString(),
      ...restartFields,
    })
    .eq("id", projectId)
    .neq("status", "generating")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!claimed) return { error: "Já existe uma geração em andamento" };

  after(() => triggerMvpGeneration(projectId));
  return { success: true };
}

export async function cancelMvpGenerationAction(projectId: string): Promise<MvpActionState> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: claimed, error } = await supabase
    .from("mvp_projects")
    .update({
      status: "failed",
      error: "Cancelado pelo operador",
      cancel_requested: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("user_id", user.id)
    .eq("status", "generating")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!claimed) return { error: "Nenhuma geração em andamento para cancelar" };
  return { success: true };
}

export type MvpStatusSnapshot = {
  status: string;
  spaceUrl: string | null;
  errorMessage: string | null;
  generatedBatches: number;
  totalBatches: number;
};

export async function getMvpStatusAction(projectId: string): Promise<MvpStatusSnapshot | null> {
  const { supabase, user } = await getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("mvp_projects")
    .select("status, space_url, error, generated_batches, total_batches")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return null;
  return {
    status: data.status,
    spaceUrl: data.space_url,
    errorMessage: data.error,
    generatedBatches: data.generated_batches ?? 0,
    totalBatches: data.total_batches ?? 0,
  };
}

export type MvpOrganizeSnapshot = {
  status: string;
  pageCount: number;
  errorMessage: string | null;
};

/**
 * Snapshot leve do progresso da organização — usado pelo loader em tempo real
 * enquanto o docx é dividido em páginas (o count é calculado no servidor para
 * não trafegar o jsonb inteiro a cada poll).
 */
export async function getMvpOrganizeSnapshotAction(
  projectId: string
): Promise<MvpOrganizeSnapshot | null> {
  const { supabase, user } = await getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("mvp_projects")
    .select("status, pages, error")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return null;
  return {
    status: data.status,
    pageCount: parseMvpPages(data.pages).length,
    errorMessage: data.error,
  };
}

export async function deleteMvpProjectAction(projectId: string): Promise<MvpActionState> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase
    .from("mvp_projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/mvp");
  return { success: true };
}
