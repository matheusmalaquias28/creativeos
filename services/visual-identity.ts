import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  visualIdentityDnaSchema,
  type ClientVisualIdentityState,
  type IdentityExtractionStatus,
} from "@/lib/schemas/visual-identity";

function parseDna(raw: unknown) {
  const parsed = visualIdentityDnaSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export const getClientVisualIdentity = cache(
  async (clientId: string): Promise<ClientVisualIdentityState> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("client_creative_profile")
      .select(
        "identity_sample_url, visual_identity_dna, identity_extracted_at, identity_extraction_status, identity_extraction_error, base_prompt, palette"
      )
      .eq("client_id", clientId)
      .maybeSingle();

    return {
      identitySampleUrl: data?.identity_sample_url ?? null,
      visualIdentityDna: parseDna(data?.visual_identity_dna),
      identityExtractedAt: data?.identity_extracted_at ?? null,
      identityExtractionStatus:
        (data?.identity_extraction_status as IdentityExtractionStatus) ?? "idle",
      identityExtractionError: data?.identity_extraction_error ?? null,
      basePrompt: data?.base_prompt ?? "",
      palette: Array.isArray(data?.palette) ? (data.palette as string[]) : [],
    };
  }
);

export { isVisualIdentityReady } from "@/lib/schemas/visual-identity";
