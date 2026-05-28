export const BRAIN_GENERATION_MESSAGES = [
  "Estruturando o DNA da marca...",
  "Reescrevendo códigos genéticos visuais...",
  "Aplicando esteróides criativos na paleta...",
  "Sintetizando neurônios de cor no laboratório...",
  "Clonando referências estéticas aprovadas...",
  "Decodificando o genoma do posicionamento...",
  "Injetando respiro entre os pixels...",
  "Calibrando margens no centrifugador de layout...",
  "Hibridizando moodboards com tipografia...",
  "Sequenciando prompts para Nano Banana Pro...",
  "Mutando estilos negativos em anticorpos visuais...",
  "Amplificando ganchos recomendados no PCR de copy...",
  "Estabilizando hierarquia visual em cadeia fria...",
  "Transcrevendo briefing em cromossomos criativos...",
] as const;

export function pickRandomBrainMessage(): string {
  const index = Math.floor(Math.random() * BRAIN_GENERATION_MESSAGES.length);
  return BRAIN_GENERATION_MESSAGES[index];
}
