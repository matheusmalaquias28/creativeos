/**
 * Revisão automática de um card: um modelo de visão lê a arte e compara com os
 * textos pedidos. Pega o erro clássico de texto em imagem gerada (letra
 * trocada, acento faltando, palavra repetida, texto inventado).
 */

import { z } from "zod";
import { inputImage, inputText, openaiStructured } from "@/lib/ai/openai-text";

const qaSchema = z.object({
  ok: z.boolean().describe("true se todos os textos estão corretos e não há texto a mais."),
  issues: z
    .array(z.string())
    .describe("Problemas encontrados, cada um curto e específico (ex.: 'escreveu \"VENDAS\" como \"VENDSA\"'). Vazio se ok."),
});

export type CardQa = z.infer<typeof qaSchema>;

/**
 * Só marca o card para revisão humana: NÃO dispara nova geração (custo).
 */
export async function reviewCardText(imageUrl: string, expected: string[], brand?: string): Promise<CardQa> {
  const result = await openaiStructured({
    system: `Você revisa artes de carrossel de Instagram antes da publicação. Leia TODO o texto visível na imagem e compare com os textos esperados.

Reprove (ok=false) se:
- algum texto esperado estiver com erro de ortografia, letra trocada/faltando, acento errado ou palavra repetida;
- algum texto esperado estiver faltando;
- houver texto da ARTE (título, apoio, selo, faixa) que não está na lista: texto inventado, numeração, @, marca d'água.

NÃO conte como texto a mais o que faz parte da cena: telas de celular/computador, documentos, papéis, embalagens, placas, roupas. Só reprove texto de cena se ele estiver grande e competindo com o título.

Não reprove por estilo, quebra de linha, maiúsculas/minúsculas ou pontuação final.
IGNORE a logo da marca${brand ? ` (${brand})` : ""} e qualquer texto dentro dela: a logo faz parte da arte e não é texto a mais.`,
    input: [
      inputText(`Textos esperados:\n${expected.map((t) => `- "${t}"`).join("\n")}`),
      inputImage(imageUrl),
    ],
    schemaName: "card_review",
    schema: qaSchema,
    reasoningEffort: "low",
    maxOutputTokens: 2000,
    timeoutMs: 60_000,
  });
  return { ok: result.ok && result.issues.length === 0, issues: result.issues.slice(0, 6) };
}
