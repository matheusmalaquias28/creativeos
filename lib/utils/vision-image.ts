/** Validação de imagens para APIs de visão (Claude, Gemini). */

export const VISION_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type VisionImageMime = (typeof VISION_IMAGE_MIMES)[number];

const MIN_IMAGE_BYTES = 200;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function isSvgUrl(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  return path.endsWith(".svg");
}

export function sniffImageMime(buffer: ArrayBuffer): VisionImageMime | null {
  if (buffer.byteLength < MIN_IMAGE_BYTES) return null;

  const bytes = new Uint8Array(buffer.slice(0, 32));
  const header = Array.from(bytes.slice(0, 12))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // GIF
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return "image/gif";
  }
  // WebP (RIFF....WEBP)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  // SVG / HTML / texto — não suportado em vision
  const textStart = new TextDecoder().decode(bytes.slice(0, 64)).trimStart();
  if (
    textStart.startsWith("<?xml") ||
    textStart.startsWith("<svg") ||
    textStart.startsWith("<!DOCTYPE") ||
    textStart.toLowerCase().includes("<svg")
  ) {
    return null;
  }

  void header;
  return null;
}

export type ValidatedVisionImage = {
  mimeType: VisionImageMime;
  base64: string;
  byteLength: number;
};

export async function fetchValidatedVisionImage(
  url: string,
  label: string
): Promise<ValidatedVisionImage | null> {
  if (isSvgUrl(url)) {
    console.warn(`[vision-image] Skip SVG: ${label}`);
    return null;
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "image/*" },
    });
    if (!res.ok) {
      console.warn(`[vision-image] HTTP ${res.status}: ${label}`);
      return null;
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      console.warn(`[vision-image] Too large (${buffer.byteLength}b): ${label}`);
      return null;
    }

    const mimeType = sniffImageMime(buffer);
    if (!mimeType) {
      console.warn(`[vision-image] Unsupported format: ${label}`);
      return null;
    }

    return {
      mimeType,
      base64: Buffer.from(buffer).toString("base64"),
      byteLength: buffer.byteLength,
    };
  } catch {
    console.warn(`[vision-image] Fetch failed: ${label}`);
    return null;
  }
}

export function isImageProcessingError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  const lower = msg.toLowerCase();
  return (
    lower.includes("could not process image") ||
    (lower.includes("invalid_request_error") && lower.includes("image"))
  );
}
