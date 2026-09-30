/**
 * Contratos do estúdio de criativos, sem I/O.
 *
 * Fica fora de `services/` de propósito: o modal é um client component e
 * `services/art-studio.ts` importa o cliente Supabase de servidor (next/headers).
 * Importar os tipos de lá derrubaria o build mesmo com `import type` em volta de
 * um helper de runtime como `effectiveStudioPrompt`.
 */

import type { DirectionMeta } from "@/lib/ai/art-director/types";
import type { PromptJobStatus } from "@/services/art-director";

export type StoryStatus = "idle" | "queued" | "processing" | "succeeded" | "failed";
export type ArtFormat = "feed" | "story";

export const ART_FORMATS: ArtFormat[] = ["feed", "story"];

export type StudioJob = {
  id: string;
  demand_id: string;
  art_index: number;
  status: PromptJobStatus;
  approved: boolean;
  prompt_draft: string | null;
  prompt_edited: string | null;
  error: string | null;
  story_status: StoryStatus;
  story_error: string | null;
  direction: DirectionMeta | null;
  params: Record<string, unknown>;
};

/** URL da versão atual de cada arte, por formato. */
export type StudioArtUrls = Record<ArtFormat, Record<string, string>>;

export type StudioState = {
  jobs: StudioJob[];
  urls: StudioArtUrls;
};

/** O texto que o operador está de fato editando. */
export function effectiveStudioPrompt(job: StudioJob): string {
  return job.prompt_edited ?? job.prompt_draft ?? "";
}

/** Status em que a arte ainda está a caminho — nada a aprovar nem a apagar. */
export function isWorking(job: StudioJob): boolean {
  return ["draft", "writing_prompt", "queued", "processing"].includes(job.status);
}

export function isStoryWorking(job: StudioJob): boolean {
  return job.story_status === "queued" || job.story_status === "processing";
}
