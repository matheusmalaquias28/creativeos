import { z } from "zod";
import { STUDIO_FONT_IDS } from "./fonts";

/**
 * Plano de design devolvido pelo diretor de arte (IA).
 *
 * A IA decide O QUE vai em cada página (layout, textos, prompts de imagem,
 * cores da paleta); a geometria é calculada em código (`layouts.ts`) — LLM é
 * ruim de coordenada e bom de direção.
 */

export const STUDIO_LAYOUTS = ["hero", "split", "statement", "feature", "cta"] as const;
export type StudioLayoutKind = (typeof STUDIO_LAYOUTS)[number];

const hex = z.string().describe("Cor hex #RRGGBB da paleta do cliente");

export const slidePlanSchema = z.object({
  layout: z
    .enum(STUDIO_LAYOUTS)
    .describe(
      "hero = foto de fundo em tela cheia + texto sobre degradê; split = imagem em card no topo e texto embaixo em fundo sólido; statement = só tipografia forte em fundo sólido/degradê; feature = elemento 3D/objeto recortado grande + texto; cta = página final de chamada com botão"
    ),
  textPosition: z.enum(["top", "center", "bottom"]),
  tone: z.enum(["dark", "light"]).describe("dark = fundo escuro com texto claro; light = fundo claro com texto escuro"),
  kicker: z.string().describe("Rótulo curto acima do título (ex.: 'PASSO 1', 'VOCÊ SABIA?'). Vazio se não fizer sentido."),
  title: z.string().describe("Título da página. Use a headline do briefing. Envolva 1 a 3 palavras-chave em *asteriscos* para destaque de cor."),
  body: z.string().describe("Texto de apoio (subheadline do briefing). Vazio se não houver."),
  cta: z.string().describe("Texto de botão. Só na página de chamada final; vazio nas demais."),
  swipeHint: z.boolean().describe("Mostrar indicação 'arraste' (normalmente em todas menos a última)"),
  backgroundPrompt: z
    .string()
    .describe("Prompt da imagem de fundo/foto (hero, split, cta). Descreva a cena em português; NUNCA peça texto, letras ou logos na imagem. Vazio para statement/feature."),
  elementPrompt: z
    .string()
    .describe("Prompt de UM elemento isolado (objeto, ícone 3D, produto, pessoa recortada) para compor a página — usado em feature e opcional em statement. Vazio se não houver."),
  elementSide: z.enum(["left", "right"]),
});

export type SlidePlan = z.infer<typeof slidePlanSchema>;

export const designPlanSchema = z.object({
  fontHeading: z.enum(STUDIO_FONT_IDS).describe("Fonte dos títulos"),
  fontBody: z.enum(STUDIO_FONT_IDS).describe("Fonte do texto de apoio"),
  colors: z.object({
    dark: hex.describe("Cor escura principal (fundos escuros / texto em fundo claro)"),
    light: hex.describe("Cor clara principal (fundos claros / texto em fundo escuro)"),
    primary: hex.describe("Cor da marca"),
    accent: hex.describe("Cor de destaque (palavras em destaque, botão, detalhes)"),
  }),
  imageStyle: z
    .string()
    .describe("Direção visual comum a TODAS as imagens (luz, paleta, estilo fotográfico/3D, textura) para o carrossel ficar coeso."),
  slides: z.array(slidePlanSchema),
  caption: z.string().describe("Legenda pronta para o Instagram, com CTA e hashtags."),
});

export type DesignPlan = z.infer<typeof designPlanSchema>;
