import { CREATIVE_BRAIN_TIMEOUT_MESSAGE } from "@/lib/constants/creative-brain-generation";

export class CreativeBrainGenerationTimeoutError extends Error {
  constructor(message = CREATIVE_BRAIN_TIMEOUT_MESSAGE) {
    super(message);
    this.name = "CreativeBrainGenerationTimeoutError";
  }
}

export function isCreativeBrainTimeoutError(error: unknown): boolean {
  return (
    error instanceof CreativeBrainGenerationTimeoutError ||
    (error instanceof Error &&
      (error.name === "CreativeBrainGenerationTimeoutError" ||
        error.message.includes("tempo limite")))
  );
}
