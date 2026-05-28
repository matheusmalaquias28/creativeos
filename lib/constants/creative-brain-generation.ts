/** Tempo máximo (ms) para uma geração de Creative Brain com Claude. */
export const CREATIVE_BRAIN_GENERATION_TIMEOUT_MS = Number(
  process.env.CREATIVE_BRAIN_GENERATION_TIMEOUT_MS ?? 120_000
);

export const CREATIVE_BRAIN_GENERATION_TIMEOUT_SECONDS = Math.floor(
  CREATIVE_BRAIN_GENERATION_TIMEOUT_MS / 1000
);

export const CREATIVE_BRAIN_TIMEOUT_MESSAGE = `A geração excedeu o tempo limite de ${CREATIVE_BRAIN_GENERATION_TIMEOUT_SECONDS} segundos. Tente novamente.`;
