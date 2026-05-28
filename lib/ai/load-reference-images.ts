import type { ClientReference } from "@/types";
import type { GeminiReferenceImage } from "@/lib/ai/gemini-image";
import { fetchValidatedVisionImage } from "@/lib/utils/vision-image";

const MAX_REFERENCES = 5;

export async function loadGeminiReferenceImages(
  references: ClientReference[],
  logoUrl?: string,
  extraUrls: string[] = []
): Promise<GeminiReferenceImage[]> {
  const images: GeminiReferenceImage[] = [];
  const sorted = [...references].sort((a, b) => a.sort_order - b.sort_order);

  for (const ref of sorted) {
    if (images.length >= MAX_REFERENCES) break;
    const validated = await fetchValidatedVisionImage(
      ref.public_url,
      ref.file_name
    );
    if (validated) {
      images.push({
        mimeType: validated.mimeType,
        base64: validated.base64,
        label: ref.file_name,
      });
    }
  }

  for (const url of extraUrls) {
    if (images.length >= MAX_REFERENCES) break;
    const validated = await fetchValidatedVisionImage(url, "extra-ref");
    if (validated) {
      images.push({
        mimeType: validated.mimeType,
        base64: validated.base64,
        label: "extra-ref",
      });
    }
  }

  if (logoUrl && images.length < MAX_REFERENCES) {
    const validated = await fetchValidatedVisionImage(logoUrl, "logo");
    if (validated) {
      images.push({
        mimeType: validated.mimeType,
        base64: validated.base64,
        label: "logo",
      });
    }
  }

  return images;
}
