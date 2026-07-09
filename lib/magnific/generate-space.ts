import { createAdminClient } from "@/lib/supabase/admin";
import { callMagnificTool } from "./client";
import { buildMagnificSpaceQuery } from "./build-space-query";
import type { DemandArte } from "@/types/demand";
import type { BrandDna } from "@/types";

const EDIT_POLL_TIMEOUT_MS = Number(process.env.MAGNIFIC_EDIT_TIMEOUT_MS ?? 120_000);
const EDIT_POLL_INTERVAL_SECONDS = 10;

export class MagnificGenerationError extends Error {
  constructor(
    public readonly step: string,
    message: string
  ) {
    super(`[${step}] ${message}`);
    this.name = "MagnificGenerationError";
  }
}

export type GenerateSpaceInput = {
  clientId: string;
  clientName: string;
  tipo: string | null;
  externalId: string;
  artes: DemandArte[];
};

export type GenerateSpaceResult = { spaceId: string; spaceUrl: string };

type ClientPhotoForUpload = {
  id: string;
  public_url: string;
  magnific_creation_id: string | null;
};

async function fetchBrandDna(clientId: string): Promise<BrandDna | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("creative_brains")
    .select("brand_dna")
    .eq("client_id", clientId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.brand_dna as BrandDna | undefined) ?? null;
}

async function fetchClientPhotos(clientId: string): Promise<ClientPhotoForUpload[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("client_photos")
    .select("id, public_url, magnific_creation_id")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true });

  if (error) throw new MagnificGenerationError("fetch_photos", error.message);
  return data ?? [];
}

/**
 * Os nomes de campo exatos devolvidos pelas tools do Magnific (creations_request_upload,
 * creations_finalize_upload, spaces_create, spaces_edit) não são documentados no schema de
 * input — só confirmados chamando de verdade. As leituras abaixo tentam as variantes mais
 * prováveis; ajustar aqui se o primeiro teste real (ver plano de verificação) mostrar outro nome.
 */
async function ensureCreationId(photo: ClientPhotoForUpload): Promise<string> {
  if (photo.magnific_creation_id) return photo.magnific_creation_id;

  const response = await fetch(photo.public_url);
  if (!response.ok) {
    throw new MagnificGenerationError(
      "upload_photo",
      `Não foi possível baixar a foto ${photo.id}: HTTP ${response.status}`
    );
  }
  const mimeType = (response.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
  const bytes = new Uint8Array(await response.arrayBuffer());

  const upload = await callMagnificTool<Record<string, unknown>>("creations_request_upload", {
    mimeType,
  });
  const uploadUrl = (upload.uploadUrl ?? upload.url ?? upload.putUrl) as string | undefined;
  const uploadPath = upload.path as string | undefined;
  if (!uploadUrl || !uploadPath) {
    throw new MagnificGenerationError(
      "upload_photo",
      `Resposta inesperada de creations_request_upload: ${JSON.stringify(upload)}`
    );
  }

  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: bytes,
  });
  if (!putResponse.ok) {
    throw new MagnificGenerationError(
      "upload_photo",
      `Falha ao subir a foto ${photo.id} pro Magnific: HTTP ${putResponse.status}`
    );
  }

  const finalized = await callMagnificTool<Record<string, unknown>>(
    "creations_finalize_upload",
    { path: uploadPath }
  );
  const identifier = (finalized.identifier ??
    (finalized.creations as { identifier?: string }[] | undefined)?.[0]?.identifier) as
    | string
    | undefined;
  if (!identifier) {
    throw new MagnificGenerationError(
      "upload_photo",
      `Resposta inesperada de creations_finalize_upload: ${JSON.stringify(finalized)}`
    );
  }

  const supabase = createAdminClient();
  await supabase
    .from("client_photos")
    .update({ magnific_creation_id: identifier })
    .eq("id", photo.id);

  return identifier;
}

async function pollEditStatus(operationId: string): Promise<void> {
  const deadline = Date.now() + EDIT_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await callMagnificTool<{ allTerminal?: boolean }>("spaces_edit_status", {
      operationId,
      timeoutSeconds: EDIT_POLL_INTERVAL_SECONDS,
    });
    if (status.allTerminal) return;
  }

  throw new MagnificGenerationError("edit_timeout", "Edição do Space não terminou a tempo.");
}

export async function generateMagnificSpace(
  input: GenerateSpaceInput
): Promise<GenerateSpaceResult> {
  const brandDna = await fetchBrandDna(input.clientId);
  if (!brandDna) {
    throw new MagnificGenerationError("brand_dna", "Cliente não tem Creative Brain gerado.");
  }

  const photos = await fetchClientPhotos(input.clientId);
  if (photos.length === 0) {
    throw new MagnificGenerationError("photos", "Cliente não tem material salvo.");
  }

  const creationIdentifiers: string[] = [];
  for (const photo of photos) {
    creationIdentifiers.push(await ensureCreationId(photo));
  }

  const space = await callMagnificTool<Record<string, unknown>>("spaces_create", {
    name: `${input.clientName} — ${input.tipo ?? "Demanda"} ${input.externalId}`,
  });
  const spaceId = (space.id ?? space.spaceId) as string | undefined;
  const spaceUrl = (space.webUrl ?? space.url) as string | undefined;
  if (!spaceId || !spaceUrl) {
    throw new MagnificGenerationError(
      "space_create",
      `Resposta inesperada de spaces_create: ${JSON.stringify(space)}`
    );
  }

  await callMagnificTool("spaces_add_creations", {
    spaceId,
    creationIdentifiers,
  });

  const query = buildMagnificSpaceQuery(brandDna, input.artes, input.tipo);
  const edit = await callMagnificTool<Record<string, unknown>>("spaces_edit", {
    spaceId,
    query,
  });
  const operationId = (edit.operationId ?? edit.runId ?? edit.threadId) as string | undefined;
  if (!operationId) {
    throw new MagnificGenerationError(
      "space_edit",
      `Resposta inesperada de spaces_edit: ${JSON.stringify(edit)}`
    );
  }

  await pollEditStatus(operationId);
  await callMagnificTool("spaces_state", { spaceId });

  return { spaceId, spaceUrl };
}
