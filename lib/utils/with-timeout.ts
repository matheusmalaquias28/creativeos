import { CreativeBrainGenerationTimeoutError } from "@/lib/errors/creative-brain-generation";

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  TimeoutError = CreativeBrainGenerationTimeoutError
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new TimeoutError()), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}
