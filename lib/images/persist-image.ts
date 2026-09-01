import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "generated-images";

export type GeneratedImageSource =
  | "carousel-turbo"
  | "carousel-editor"
  | "gerador"
  | "artes";

export type PersistImageParams = {
  /** URL remota (ex: CDN temporária da Magnific) */
  url: string;
  source: GeneratedImageSource;
  userId?: string | null;
  prompt?: string;
  aspectRatio?: string;
  resolution?: string;
};

export type PersistedImage = {
  /** URL permanente no Storage (ou a original, se a persistência falhar) */
  url: string;
  id: string | null;
  storagePath: string | null;
};

function extFromContentType(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

/**
 * Baixa uma imagem remota, sobe pro bucket generated-images e registra na
 * tabela generated_images (galeria). As URLs da Magnific expiram — sem isso
 * as imagens somem depois de um tempo.
 *
 * Nunca lança: em caso de falha retorna a URL original para não quebrar o fluxo.
 */
export async function persistImageFromUrl(
  params: PersistImageParams
): Promise<PersistedImage> {
  try {
    const res = await fetch(params.url);
    if (!res.ok) throw new Error(`download falhou (${res.status})`);
    const contentType =
      res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) throw new Error("download vazio");

    const storagePath = `${params.source}/${randomUUID()}.${extFromContentType(contentType)}`;
    const supabase = createAdminClient();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: false });
    if (uploadError) throw new Error(`upload falhou: ${uploadError.message}`);

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    const id = await registerGeneratedImage({
      url: pub.publicUrl,
      storagePath,
      source: params.source,
      userId: params.userId,
      prompt: params.prompt,
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
    });

    return { url: pub.publicUrl, id, storagePath };
  } catch (err) {
    console.error("[persist-image] mantendo URL original:", err);
    return { url: params.url, id: null, storagePath: null };
  }
}

/**
 * Registra na galeria uma imagem que já está persistida (ex: artes do
 * pipeline, que já sobem pro bucket art-generations).
 */
export async function registerGeneratedImage(params: {
  url: string;
  storagePath?: string | null;
  source: GeneratedImageSource;
  userId?: string | null;
  prompt?: string;
  aspectRatio?: string;
  resolution?: string;
}): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("generated_images")
    .insert({
      user_id: params.userId ?? null,
      source: params.source,
      prompt: params.prompt ?? "",
      aspect_ratio: params.aspectRatio ?? "1:1",
      resolution: params.resolution ?? "2K",
      storage_path: params.storagePath ?? null,
      url: params.url,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[persist-image] registro na galeria falhou:", error.message);
    return null;
  }
  return data.id;
}
