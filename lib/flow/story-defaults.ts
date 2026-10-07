/**
 * Padrões do node de stories (9:16). Isomórfico (sem provider/sharp) — usado
 * pelo gerador do canvas, pelo enrich, pelo extractor e pelo worker de 2 fases.
 */

/** Instrução padrão de reenquadramento — semeada no prompt do node, visível. */
export const STORY_PROMPT =
  "Adapte essa arte para o formato stories 9:16, sem adicionar novos textos e distorcer as imagens originais";

/** Textos padrão anteriores: nodes que ainda têm um deles são atualizados. */
export const LEGACY_STORY_PROMPTS = [
  "Adapte essas artes para o formato stories 9:16, sem adicionar textos e distorcer imagens",
];

/** Stories é só reenquadramento: esforço SEMPRE low. */
export const STORY_QUALITY = "low" as const;
