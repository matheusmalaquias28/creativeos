import {
  makeDefaultSlide,
  makeDefaultCta,
  makeDefaultImageGrid,
  type CarouselSlide,
  type ImageGridLayout,
  type TextPosition,
} from "@/types/carousel";

/** Fill a resolved image URL into the correct slot of a built slide (server + client). */
export function applyImageToSlide(slide: CarouselSlide, k: number, url: string) {
  if (slide.imageGrid?.enabled) {
    const images = [...slide.imageGrid.images];
    while (images.length < 3) images.push(null);
    images[k] = url;
    slide.imageGrid.images = images;
  } else {
    slide.imagemFundo = url;
    slide.overlayOpacidade = 55;
  }
}
import type { CarouselProfile } from "@/types/carousel-profile";
import { DEFAULT_FONT_FAMILY } from "@/lib/design/fonts";

export const TEXT_POSITIONS: TextPosition[] = [
  "top-left", "top-center", "top-right",
  "middle-left", "middle-center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
];

export type TurboLayout = "background" | "grid1" | "grid2" | "grid3";

export type TurboSlideSpec = {
  titulo: string;
  subtitulo: string;
  textPos: TextPosition;
  textGlass?: boolean;
  corFundo: string;
  corTitulo: string;
  corSubtitulo: string;
  layout: TurboLayout;
  bgPrompt: string;
  gridPrompts?: string[];
  cta?: { text: string } | null;
};

export type TurboSpec = {
  slides: TurboSlideSpec[];
  caption: string;
};

/** JSON Schema for the build_carousel tool the model must call. */
export const BUILD_CAROUSEL_TOOL = {
  name: "build_carousel",
  description:
    "Entrega o carrossel final estruturado, com todos os cards, textos, posições, cores e prompts de imagem.",
  input_schema: {
    type: "object" as const,
    properties: {
      slides: {
        type: "array",
        description: "Entre 4 e 10 cards.",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            subtitulo: { type: "string" },
            textPos: { type: "string", enum: TEXT_POSITIONS },
            textGlass: { type: "boolean" },
            corFundo: { type: "string", description: "Hex da paleta do cliente" },
            corTitulo: { type: "string", description: "Hex da paleta do cliente" },
            corSubtitulo: { type: "string", description: "Hex da paleta do cliente" },
            layout: { type: "string", enum: ["background", "grid1", "grid2", "grid3"] },
            bgPrompt: {
              type: "string",
              description:
                "Prompt para a imagem de fundo (layout background) ou 1ª imagem do grid. Cenário brasileiro quando fizer sentido; qualquer texto na imagem em português do Brasil.",
            },
            gridPrompts: {
              type: "array",
              items: { type: "string" },
              description:
                "Prompts para as imagens do grid (grid2=2, grid3=3). Cenário brasileiro quando fizer sentido; texto em português do Brasil.",
            },
            cta: {
              type: "object",
              properties: { text: { type: "string" } },
              description: "Use apenas quando fizer sentido (normalmente no último card).",
            },
          },
          required: [
            "titulo", "subtitulo", "textPos", "corFundo",
            "corTitulo", "corSubtitulo", "layout", "bgPrompt",
          ],
        },
      },
      caption: { type: "string", description: "Legenda pronta para o Instagram, com hashtags." },
    },
    required: ["slides", "caption"],
  },
};

export function profilePalette(profile: CarouselProfile): string[] {
  const base = [
    profile.color_background,
    profile.color_title,
    profile.color_subtitle,
    profile.color_accent,
  ];
  const extra = Array.isArray(profile.palette) ? profile.palette : [];
  return [...new Set([...base, ...extra])].filter(Boolean);
}

/**
 * "ai": pesquisa o tema e escreve o conteúdo.
 * "manual": o usuário já tem o conteúdo; a IA só organiza em cards e define o design.
 */
export type TurboContentMode = "ai" | "manual";

export function buildSystemPrompt(
  profile: CarouselProfile,
  theme: string,
  cardCount?: number,
  mode: TurboContentMode = "ai"
): string {
  if (mode === "manual") return buildManualSystemPrompt(profile, cardCount);

  const palette = profilePalette(profile).join(", ");
  const context =
    profile.context_md?.trim() ||
    profile.business_context?.trim() ||
    "(Sem contexto detalhado do cliente — use bom senso.)";

  const countRule = cardCount
    ? `QUANTIDADE DE CARDS: gere EXATAMENTE ${cardCount} cards, ajustando a profundidade do conteúdo para caber bem nesse número.`
    : "QUANTIDADE DE CARDS: entre 4 e 8 cards, o que melhor contar a história.";

  return `Você é um diretor de conteúdo especialista em carrosséis virais de Instagram.

CLIENTE: ${profile.name}
CONTEXTO DA MARCA:
${context}

PALETA DE CORES (use SOMENTE estes valores hex): ${palette}
- Fundo padrão: ${profile.color_background}
- Título: ${profile.color_title}
- Subtítulo: ${profile.color_subtitle}
- Destaque: ${profile.color_accent}

TAREFA: criar um carrossel sobre o tema pedido pelo usuário.
1. Pesquise na web dados atuais, números e ângulos relevantes sobre o tema (faça poucas buscas, objetivas).
2. Pense na melhor narrativa (gancho → desenvolvimento → prova → CTA).
3. Ao final, CHAME a ferramenta build_carousel com o resultado completo.

${countRule}

REGRAS DE CONTEÚDO:
- NUNCA use travessão (— ou –) em nenhum texto. Use vírgula, ponto ou frases curtas.
- Textos em português, no tom de comunicação da marca.
- Títulos curtos e impactantes; subtítulos complementares e diretos.
- Varie a posição do texto (textPos) entre os cards para ficar dinâmico.
- Use SOMENTE cores da paleta acima em corFundo/corTitulo/corSubtitulo, garantindo contraste legível.
- Varie os layouts: alguns cards com "background" (imagem de fundo) e alguns com grid ("grid1", "grid2", "grid3") quando ajudar a contar a história.
- Sempre forneça bgPrompt (descritivo, coerente com a marca). Para grids, forneça gridPrompts com a quantidade certa de imagens.
- Nos prompts de imagem, prefira cenários, ambientes e pessoas brasileiras quando fizer sentido. Se a imagem tiver qualquer texto, ele deve estar em português do Brasil (nunca em inglês).
- Use CTA apenas no último card (ex.: "Salve este post", "Comente EU QUERO").
- Para legibilidade sobre imagens de fundo, conte com o overlay escuro do fundo — NÃO use retângulo glassmorphism (textGlass deve ser false).

TEMA DO USUÁRIO: "${theme}"`;
}

/** Conteúdo do usuário: só organiza em cards (sem pesquisa, sem reescrever). */
function buildManualSystemPrompt(profile: CarouselProfile, cardCount?: number): string {
  const palette = profilePalette(profile).join(", ");
  const context =
    profile.context_md?.trim() ||
    profile.business_context?.trim() ||
    "(Sem contexto detalhado do cliente — use bom senso.)";

  const countRule = cardCount
    ? `QUANTIDADE DE CARDS: distribua o conteúdo em EXATAMENTE ${cardCount} cards (juntando ou dividindo blocos), sem inventar nem cortar ideias.`
    : "QUANTIDADE DE CARDS: se o conteúdo já vier separado em blocos/cards (numeração, linhas em branco, \"Card 1\", \"Slide 2\" etc.), respeite essa divisão, 1 bloco = 1 card. Senão, divida no número de cards que o texto pedir (entre 3 e 10).";

  return `Você é um diretor de arte especialista em carrosséis de Instagram.

CLIENTE: ${profile.name}
CONTEXTO DA MARCA:
${context}

PALETA DE CORES (use SOMENTE estes valores hex): ${palette}
- Fundo padrão: ${profile.color_background}
- Título: ${profile.color_title}
- Subtítulo: ${profile.color_subtitle}
- Destaque: ${profile.color_accent}

TAREFA: o usuário JÁ ESCREVEU o conteúdo do carrossel. Você NÃO cria conteúdo novo e NÃO pesquisa: só organiza o texto dele em cards e define o design de cada card.

${countRule}

REGRAS DE CONTEÚDO (fidelidade):
- Use as PALAVRAS DO USUÁRIO. Não reescreva, não resuma, não acrescente ideias, dados ou frases.
- Em cada card, o trecho principal/mais forte vira "titulo" e o restante vira "subtitulo". Se o bloco tiver só uma frase, deixe o subtitulo vazio.
- Se o usuário já marcou título e texto (ex.: "Título:", "Texto:", primeira linha em destaque), respeite.
- Só ajuste o mínimo para caber no card: quebrar frases longas entre título e subtítulo, tirar marcações como "Card 1:" ou "Slide 2 -".
- Mantenha a ordem do conteúdo.
- NUNCA use travessão (— ou –). Se houver no texto do usuário, troque por vírgula ou ponto.
- CTA: só no último card e só se o conteúdo do usuário tiver uma chamada para ação (use o texto dele). Não invente CTA.
- "caption": se o usuário mandou uma legenda, use-a; senão, escreva uma legenda curta baseada no próprio conteúdo.

REGRAS DE DESIGN:
- Varie a posição do texto (textPos) entre os cards para ficar dinâmico.
- Use SOMENTE cores da paleta acima em corFundo/corTitulo/corSubtitulo, garantindo contraste legível.
- Varie os layouts: alguns cards com "background" (imagem de fundo) e alguns com grid ("grid1", "grid2", "grid3") quando ajudar a ilustrar o conteúdo.
- Sempre forneça bgPrompt (descritivo, coerente com a marca e com o texto do card). Para grids, forneça gridPrompts com a quantidade certa de imagens.
- Nos prompts de imagem, prefira cenários, ambientes e pessoas brasileiras quando fizer sentido. Se a imagem tiver qualquer texto, ele deve estar em português do Brasil (nunca em inglês).
- Para legibilidade sobre imagens de fundo, conte com o overlay escuro do fundo — NÃO use retângulo glassmorphism (textGlass deve ser false).

Ao final, CHAME a ferramenta build_carousel com o resultado completo.`;
}

/** Convert one spec + resolved image URLs into a CarouselSlide. */
export function specToSlide(
  spec: TurboSlideSpec,
  images: (string | null)[],
  profile: CarouselProfile
): CarouselSlide {
  const font = profile.font_title || DEFAULT_FONT_FAMILY;
  const isGrid = spec.layout.startsWith("grid");
  const gridLayout: ImageGridLayout =
    spec.layout === "grid2" ? 2 : spec.layout === "grid3" ? 3 : 1;

  const slide = makeDefaultSlide({
    titulo: spec.titulo,
    subtitulo: spec.subtitulo,
    fonteFamilia: font,
    textPos: spec.textPos,
    // Turbo prefers a background overlay over the glassmorphism rectangle.
    textGlass: false,
    corFundo: spec.corFundo || profile.color_background,
    corTitulo: spec.corTitulo || profile.color_title,
    corSubtitulo: spec.corSubtitulo || profile.color_subtitle,
  });

  const allPrompts = [spec.bgPrompt, ...(spec.gridPrompts ?? [])];

  if (isGrid) {
    const imgs = [...images];
    while (imgs.length < 3) imgs.push(null);
    const prompts: (string | null)[] = [...allPrompts];
    while (prompts.length < 3) prompts.push(null);
    slide.imageGrid = makeDefaultImageGrid();
    slide.imageGrid.enabled = true;
    slide.imageGrid.layout = gridLayout;
    slide.imageGrid.images = imgs.slice(0, 3);
    slide.imageGrid.prompts = prompts.slice(0, 3);
  } else {
    slide.imagemFundo = images[0] ?? null;
    slide.bgPrompt = spec.bgPrompt ?? null;
    // Dark gradient overlay keeps text legible over the background image.
    if (slide.imagemFundo) slide.overlayOpacidade = 55;
  }

  if (spec.cta?.text) {
    slide.cta = makeDefaultCta({
      enabled: true,
      text: spec.cta.text,
      bgColor: profile.color_accent,
      textColor: profile.color_background,
      fontFamily: font,
    });
  }

  return slide;
}

/** How many images a spec needs to generate. */
export function imagesNeeded(spec: TurboSlideSpec): number {
  if (spec.layout === "grid2") return 2;
  if (spec.layout === "grid3") return 3;
  return 1;
}

/**
 * Aspect ratio that matches each grid cell so the generated image fills it
 * without heavy cropping (quality stays 2K).
 * - grid1: single 4:3 frame.
 * - grid2: two tall verticals → 3:4.
 * - grid3: big-left is tall (3:4); the two stacked right cells are landscape (4:3).
 */
export function slotAspect(layout: TurboLayout, k: number): string {
  if (layout === "grid1") return "4:3";
  if (layout === "grid2") return "3:4";
  if (layout === "grid3") return k === 0 ? "3:4" : "4:3";
  return "4:5";
}
