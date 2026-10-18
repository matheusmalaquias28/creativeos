import { z } from "zod";
import { STUDIO_FONT_IDS } from "@/lib/carousel-studio/fonts";
import { STUDIO_LAYOUTS } from "@/lib/carousel-studio/plan";

/**
 * DNA de um estilo de carrossel: o que a IA extraiu lendo TODAS as artes de
 * exemplo juntas. É texto para o diretor de arte, não geometria — a geometria
 * continua em `layouts.ts` (e, na próxima etapa, nas páginas-modelo do estilo).
 *
 * Fica separado do analisador para o diretor e o front importarem sem puxar o
 * SDK da Anthropic.
 */

const hex = z.string().describe("Cor hex #RRGGBB vista nas artes");

export const styleDnaSchema = z.object({
  summary: z
    .string()
    .describe("2 a 3 frases: a personalidade do estilo, como um diretor de arte descreveria para outro."),
  layoutGrammar: z
    .string()
    .describe("Grid, margens, alinhamento, onde ficam título/corpo/imagem, hierarquia, uso de respiro. Concreto (ex.: 'título alinhado à esquerda no terço superior, margem ~8% da largura')."),
  typography: z.object({
    headingFont: z.enum(STUDIO_FONT_IDS).describe("Fonte disponível mais próxima da usada nos títulos"),
    bodyFont: z.enum(STUDIO_FONT_IDS).describe("Fonte disponível mais próxima da usada no texto"),
    notes: z
      .string()
      .describe("Pesos, caixa alta/baixa, contraste de tamanho título/corpo, como os destaques são feitos (cor, marca-texto, sublinhado, itálico)."),
  }),
  color: z.object({
    usage: z
      .string()
      .describe("Como as cores são usadas: proporção fundo/texto/acento, fundos claros ou escuros, onde entra a cor de destaque. Independe da paleta exata."),
    palette: z.object({
      dark: hex,
      light: hex,
      primary: hex,
      accent: hex,
    }),
  }),
  imageTreatment: z
    .string()
    .describe("Tipo de imagem (foto real, 3D, flat, colagem, recorte), luz, enquadramento, molduras/cantos, como a imagem se integra ao fundo."),
  imageStylePrompt: z
    .string()
    .describe("Direção visual pronta para prompts de imagem (luz, lente, material, textura, paleta). Sem citar texto nem marca."),
  recurringElements: z
    .array(
      z.object({
        name: z.string().describe("Nome curto (ex.: 'pílula numerada', 'seta de arraste', 'linha fina')"),
        description: z.string().describe("Como é desenhado: forma, cor, tamanho relativo"),
        placement: z.string().describe("Onde aparece e em quais cards"),
      })
    )
    .describe("Elementos gráficos que se repetem e dão a identidade (formas, selos, ícones, numeração, molduras)."),
  pages: z.object({
    cover: z.string().describe("Como a capa é montada (gancho)."),
    inner: z.string().describe("Como os cards do meio são montados e como variam entre si."),
    cta: z.string().describe("Como o card final de chamada é montado."),
  }),
  variationRules: z
    .string()
    .describe("O que muda de um card para o outro e o que nunca muda — para os cards serem diferentes com a mesma identidade."),
  preferredLayouts: z
    .array(z.enum(STUDIO_LAYOUTS))
    .describe("Quais layouts do Studio mais se aproximam deste estilo, em ordem de preferência."),
  avoid: z.array(z.string()).describe("O que quebraria o estilo (ex.: 'fotos de banco genéricas', 'degradês')."),
});

export type StyleDna = z.infer<typeof styleDnaSchema>;

export function isStyleDna(value: unknown): value is StyleDna {
  return styleDnaSchema.safeParse(value).success;
}

/** DNA em texto para o prompt do diretor de arte. */
export function styleDnaText(dna: StyleDna): string {
  const elements = dna.recurringElements
    .map((e) => `  - ${e.name}: ${e.description} (${e.placement})`)
    .join("\n");
  return [
    `Resumo: ${dna.summary}`,
    `Layout: ${dna.layoutGrammar}`,
    `Tipografia: títulos em ${dna.typography.headingFont}, texto em ${dna.typography.bodyFont}. ${dna.typography.notes}`,
    `Cor: ${dna.color.usage} (paleta das artes de exemplo: escuro ${dna.color.palette.dark}, claro ${dna.color.palette.light}, primária ${dna.color.palette.primary}, acento ${dna.color.palette.accent})`,
    `Imagem: ${dna.imageTreatment}`,
    elements ? `Elementos recorrentes:\n${elements}` : "",
    `Capa: ${dna.pages.cover}`,
    `Miolo: ${dna.pages.inner}`,
    `CTA: ${dna.pages.cta}`,
    `Variação entre cards: ${dna.variationRules}`,
    dna.preferredLayouts.length ? `Layouts do Studio mais próximos: ${dna.preferredLayouts.join(", ")}` : "",
    dna.avoid.length ? `Evitar: ${dna.avoid.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
