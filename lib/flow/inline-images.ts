/**
 * Tira imagens base64 (`data:image/...`) de dentro do grafo do fluxo.
 *
 * O grafo é regravado inteiro a cada salvamento (autosave e antes de cada
 * geração). Uma única imagem embutida deixava a linha com vários MB e o upsert
 * estourava o `statement_timeout` do Postgres. Aqui cada data URL sobe para o
 * Storage e o grafo passa a guardar só a URL pública.
 *
 * O caminho é o hash do conteúdo: salvar de novo um canvas que ainda tem o
 * base64 em memória reaproveita o mesmo arquivo, sem duplicar no bucket.
 */

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "art-generations";
const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,/i;

export type InlineImageUploader = (bytes: Buffer, mime: string, hash: string) => Promise<string>;

function extFromMime(mime: string): string {
  const sub = mime.split("/")[1]?.toLowerCase() ?? "png";
  if (sub === "jpeg") return "jpg";
  if (sub === "svg+xml") return "svg";
  return sub.replace(/[^a-z0-9]/g, "") || "png";
}

const storageUploader: InlineImageUploader = async (bytes, mime, hash) => {
  const admin = createAdminClient();
  const path = `flow-uploads/inline/${hash}.${extFromMime(mime)}`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw new Error(`Falha ao enviar imagem do fluxo ao Storage: ${error.message}`);
  return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
};

/**
 * Devolve uma cópia do valor com toda string `data:image/...;base64,...`
 * trocada pela URL no Storage. Strings iguais sobem uma vez só.
 */
export async function uploadInlineImages<T>(
  value: T,
  upload: InlineImageUploader = storageUploader
): Promise<{ value: T; uploaded: number }> {
  const urls = new Map<string, Promise<string>>();

  const toUrl = (dataUrl: string, mime: string) => {
    let url = urls.get(dataUrl);
    if (!url) {
      const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
      const hash = createHash("sha256").update(bytes).digest("hex");
      url = upload(bytes, mime.toLowerCase(), hash);
      urls.set(dataUrl, url);
    }
    return url;
  };

  const walk = async (v: unknown): Promise<unknown> => {
    if (typeof v === "string") {
      const match = DATA_URL_RE.exec(v);
      return match ? toUrl(v, match[1]) : v;
    }
    if (Array.isArray(v)) return Promise.all(v.map(walk));
    if (v && typeof v === "object") {
      const entries = await Promise.all(
        Object.entries(v).map(async ([k, x]) => [k, await walk(x)] as const)
      );
      return Object.fromEntries(entries);
    }
    return v;
  };

  const result = (await walk(value)) as T;
  return { value: result, uploaded: urls.size };
}
