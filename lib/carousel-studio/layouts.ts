/**
 * Plano de design → documento em camadas.
 *
 * Cada layout é uma receita de geometria pensada para 1080×(1080|1350|1920):
 * margens, hierarquia tipográfica e respiro calculados aqui, não pela IA. O
 * tamanho do título é ajustado pela estimativa de quebra (`text-fit.ts`).
 */

import {
  STUDIO_FORMATS,
  type StudioBrandKit,
  type StudioDocument,
  type StudioFormat,
  type StudioImageLayer,
  type StudioLayer,
  type StudioPage,
  type StudioTextAlign,
} from "@/types/carousel-studio";
import type { DesignPlan, SlidePlan } from "./plan";
import { studioFontById } from "./fonts";
import { bestOn, cleanHex, contrast, deriveRoles } from "./color";
import { estimateTextHeight, fitFontSize, stripAccentMarkers } from "./text-fit";
import {
  makeButtonLayer,
  makeImageLayer,
  makePage,
  makeShapeLayer,
  makeTextLayer,
} from "./layers";

export type StudioImageJob = {
  pageId: string;
  layerId: string;
  kind: "background" | "element";
  prompt: string;
  aspectRatio: string;
};

type Palette = { dark: string; light: string; primary: string; accent: string };

type Ctx = {
  W: number;
  H: number;
  M: number;
  palette: Palette;
  heading: ReturnType<typeof studioFontById>;
  body: ReturnType<typeof studioFontById>;
  brand: StudioBrandKit;
  index: number;
  total: number;
  imageStyle: string;
  jobs: StudioImageJob[];
};

const SUPPORTED_ASPECTS: Array<[string, number]> = [
  ["1:1", 1],
  ["4:5", 4 / 5],
  ["3:4", 3 / 4],
  ["9:16", 9 / 16],
  ["4:3", 4 / 3],
  ["16:9", 16 / 9],
];

/** Aspect suportado pelos provedores mais próximo da caixa. */
export function nearestAspect(width: number, height: number): string {
  const ratio = width / height;
  return SUPPORTED_ASPECTS.reduce((best, cur) =>
    Math.abs(Math.log(cur[1] / ratio)) < Math.abs(Math.log(best[1] / ratio)) ? cur : best
  )[0];
}

const NO_TEXT_RULE =
  "A imagem NÃO pode conter nenhum texto, letra, número, palavra, logotipo, marca d'água ou interface.";

function backgroundPrompt(ctx: Ctx, scene: string, textZone: string): string {
  return [
    scene.trim(),
    ctx.imageStyle ? `Direção visual: ${ctx.imageStyle.trim()}` : "",
    `Paleta predominante: ${[ctx.palette.dark, ctx.palette.primary, ctx.palette.accent].join(", ")}.`,
    `Composição com área limpa e pouco detalhada ${textZone} para receber texto depois.`,
    "Pessoas, cenários e contexto brasileiros quando fizer sentido. Alta qualidade, foco nítido.",
    NO_TEXT_RULE,
  ]
    .filter(Boolean)
    .join(" ");
}

function elementPrompt(ctx: Ctx, subject: string): string {
  return [
    subject.trim(),
    "Objeto único, isolado e centralizado, inteiro dentro do quadro com margem em volta.",
    "Fundo branco puro (#FFFFFF), liso e uniforme, sem sombra projetada no chão, sem cenário.",
    ctx.imageStyle ? `Estilo: ${ctx.imageStyle.trim()}` : "",
    `Cores do objeto em harmonia com: ${[ctx.palette.primary, ctx.palette.accent].join(", ")}.`,
    NO_TEXT_RULE,
  ]
    .filter(Boolean)
    .join(" ");
}

// ─── Blocos reutilizáveis ────────────────────────────────────────────────────

type TextBlockInput = {
  x: number;
  width: number;
  top: number;
  bottom: number;
  anchor: "top" | "center" | "bottom";
  align: StudioTextAlign;
  background: string;
  kicker: string;
  title: string;
  body: string;
  cta: string;
  maxTitle: number;
  minTitle?: number;
};

function textColorsOn(ctx: Ctx, background: string) {
  const text = bestOn(background, [ctx.palette.light, ctx.palette.dark, "#ffffff", "#0b0b0f"]);
  const accentCandidates = [ctx.palette.accent, ctx.palette.primary];
  const accent = accentCandidates.find((c) => contrast(c, background) >= 2.4) ?? text;
  return { text, accent };
}

function textBlock(ctx: Ctx, input: TextBlockInput): StudioLayer[] {
  const { text, accent } = textColorsOn(ctx, input.background);
  const available = Math.max(200, input.bottom - input.top);
  const headingWeight = ctx.heading.heavy;
  const isCondensed = ctx.heading.id === "bebas-neue" || ctx.heading.id === "oswald";

  const kickerSize = 28;
  const kickerH = input.kicker ? Math.ceil(kickerSize * 1.25) : 0;
  const ctaH = input.cta ? 104 : 0;

  const bodyText = input.body.trim();
  const titleText = input.title.trim();
  const titleLineHeight = isCondensed ? 1.0 : 1.08;

  // O título leva até ~62% do espaço; o resto é do texto de apoio.
  const titleMaxH = bodyText ? available * 0.6 - kickerH : available - kickerH - ctaH;
  const titleSize = fitFontSize({
    text: titleText,
    width: input.width,
    maxHeight: Math.max(120, titleMaxH),
    fontFamily: ctx.heading.family,
    lineHeight: titleLineHeight,
    min: input.minTitle ?? 52,
    max: input.maxTitle,
    maxLines: 6,
    uppercase: isCondensed,
  });
  const titleH = estimateTextHeight({
    text: titleText,
    fontSize: titleSize,
    width: input.width,
    fontFamily: ctx.heading.family,
    lineHeight: titleLineHeight,
    uppercase: isCondensed,
  });

  const gapKicker = input.kicker ? 22 : 0;
  const gapBody = bodyText ? Math.round(titleSize * 0.38) : 0;
  const gapCta = input.cta ? 48 : 0;

  const bodyMaxH = Math.max(80, available - kickerH - gapKicker - titleH - gapBody - gapCta - ctaH);
  const bodySize = bodyText
    ? fitFontSize({
        text: bodyText,
        width: input.width,
        maxHeight: bodyMaxH,
        fontFamily: ctx.body.family,
        lineHeight: 1.35,
        min: 26,
        max: Math.min(42, Math.round(titleSize * 0.5)),
      })
    : 0;
  const bodyH = bodyText
    ? estimateTextHeight({
        text: bodyText,
        fontSize: bodySize,
        width: input.width,
        fontFamily: ctx.body.family,
        lineHeight: 1.35,
      })
    : 0;

  const totalH = kickerH + gapKicker + titleH + gapBody + bodyH + gapCta + ctaH;
  let y =
    input.anchor === "top"
      ? input.top
      : input.anchor === "bottom"
        ? input.bottom - totalH
        : input.top + (available - totalH) / 2;
  y = Math.round(Math.max(input.top - 40, y));

  const layers: StudioLayer[] = [];
  if (input.kicker) {
    layers.push(
      makeTextLayer({
        name: "Rótulo",
        x: input.x,
        y,
        width: input.width,
        height: kickerH,
        text: input.kicker.toUpperCase(),
        fontFamily: ctx.body.family,
        fontSize: kickerSize,
        fontWeight: 700,
        color: accent,
        accentColor: accent,
        align: input.align,
        lineHeight: 1.25,
        letterSpacing: 4,
        uppercase: true,
      })
    );
    y += kickerH + gapKicker;
  }

  layers.push(
    makeTextLayer({
      name: "Título",
      x: input.x,
      y,
      width: input.width,
      height: titleH,
      text: titleText,
      fontFamily: ctx.heading.family,
      fontSize: titleSize,
      fontWeight: headingWeight,
      color: text,
      accentColor: accent,
      align: input.align,
      lineHeight: titleLineHeight,
      letterSpacing: isCondensed ? 1 : -Math.round(titleSize * 0.02),
      uppercase: isCondensed,
    })
  );
  y += titleH + gapBody;

  if (bodyText) {
    layers.push(
      makeTextLayer({
        name: "Texto de apoio",
        x: input.x,
        y,
        width: input.width,
        height: bodyH,
        text: bodyText,
        fontFamily: ctx.body.family,
        fontSize: bodySize,
        fontWeight: ctx.body.regular,
        color: text,
        accentColor: accent,
        align: input.align,
        lineHeight: 1.35,
        opacity: 0.88,
      })
    );
    y += bodyH + gapCta;
  }

  if (input.cta) {
    const label = stripAccentMarkers(input.cta);
    const width = Math.min(input.width, Math.round(label.length * 34 * 0.6 + 96 + 52));
    const fill = ctx.palette.accent;
    const x =
      input.align === "center"
        ? Math.round(input.x + (input.width - width) / 2)
        : input.align === "right"
          ? input.x + input.width - width
          : input.x;
    layers.push(
      makeButtonLayer({
        name: "Botão",
        x,
        y,
        width,
        height: ctaH,
        text: label,
        fontFamily: ctx.body.family,
        fontSize: 34,
        fontWeight: 700,
        fill,
        color: bestOn(fill, [ctx.palette.dark, ctx.palette.light, "#0b0b0f", "#ffffff"]),
        icon: "ArrowRight",
      })
    );
  }

  return layers;
}

/** Logo, numeração e "arraste" — a moldura comum a todas as páginas. */
function chrome(ctx: Ctx, background: string, opts: { swipe: boolean; logo: boolean }): StudioLayer[] {
  const { text } = textColorsOn(ctx, background);
  const layers: StudioLayer[] = [];
  if (opts.logo && ctx.brand.logoUrl) {
    layers.push(
      makeImageLayer({
        name: "Logo",
        role: "logo",
        src: ctx.brand.logoUrl,
        fit: "contain",
        focusX: 0,
        x: ctx.M,
        y: ctx.M - 20,
        width: 240,
        height: 84,
      })
    );
  } else if (opts.logo && ctx.brand.handle) {
    layers.push(
      makeTextLayer({
        name: "@ do cliente",
        x: ctx.M,
        y: ctx.M,
        width: 520,
        height: 36,
        text: ctx.brand.handle.startsWith("@") ? ctx.brand.handle : `@${ctx.brand.handle}`,
        fontFamily: ctx.body.family,
        fontSize: 28,
        fontWeight: 600,
        color: text,
        accentColor: text,
        lineHeight: 1.25,
        opacity: 0.85,
      })
    );
  }

  if (ctx.total > 1) {
    const label = `${String(ctx.index + 1).padStart(2, "0")}/${String(ctx.total).padStart(2, "0")}`;
    layers.push(
      makeTextLayer({
        name: "Paginação",
        x: ctx.W - ctx.M - 200,
        y: ctx.M,
        width: 200,
        height: 36,
        text: label,
        fontFamily: ctx.body.family,
        fontSize: 26,
        fontWeight: 600,
        color: text,
        accentColor: text,
        align: "right",
        lineHeight: 1.25,
        letterSpacing: 2,
        opacity: 0.7,
      })
    );
  }

  if (opts.swipe) {
    layers.push(
      makeTextLayer({
        name: "Arraste",
        x: ctx.W - ctx.M - 420,
        y: ctx.H - ctx.M - 30,
        width: 420,
        height: 36,
        text: "arraste para o lado  →",
        fontFamily: ctx.body.family,
        fontSize: 26,
        fontWeight: 600,
        color: text,
        accentColor: text,
        align: "right",
        lineHeight: 1.25,
        opacity: 0.75,
      })
    );
  }
  return layers;
}

function imageJob(ctx: Ctx, page: StudioPage, layer: StudioImageLayer, kind: StudioImageJob["kind"]) {
  if (!layer.prompt) return;
  ctx.jobs.push({
    pageId: page.id,
    layerId: layer.id,
    kind,
    prompt: layer.prompt,
    aspectRatio: nearestAspect(layer.width, layer.height),
  });
}

// ─── Layouts ─────────────────────────────────────────────────────────────────

function heroPage(ctx: Ctx, slide: SlidePlan, page: StudioPage, isLast: boolean) {
  const { W, H, M } = ctx;
  const shade = slide.tone === "light" ? ctx.palette.light : ctx.palette.dark;
  page.background = shade;
  const zone = slide.textPosition === "top" ? "no terço superior" : slide.textPosition === "center" ? "no centro" : "no terço inferior";

  const bg = makeImageLayer({
    name: "Imagem de fundo",
    role: "background",
    width: W,
    height: H,
    prompt: slide.backgroundPrompt ? backgroundPrompt(ctx, slide.backgroundPrompt, zone) : null,
    status: slide.backgroundPrompt ? "generating" : null,
  });

  const stops =
    slide.textPosition === "top"
      ? [
          { color: shade, opacity: 0.95, at: 0 },
          { color: shade, opacity: 0.7, at: 32 },
          { color: shade, opacity: 0, at: 70 },
        ]
      : slide.textPosition === "center"
        ? [
            { color: shade, opacity: 0.55, at: 0 },
            { color: shade, opacity: 0.55, at: 100 },
          ]
        : [
            { color: shade, opacity: 0, at: 28 },
            { color: shade, opacity: 0.78, at: 62 },
            { color: shade, opacity: 0.96, at: 100 },
          ];
  const overlay = makeShapeLayer({
    name: "Degradê",
    locked: true,
    width: W,
    height: H,
    fill: shade,
    gradient: { angle: 180, stops },
  });

  const top = slide.textPosition === "bottom" ? Math.round(H * 0.42) : M + 130;
  const bottom = slide.textPosition === "top" ? Math.round(H * 0.62) : H - M - 70;
  page.layers.push(
    bg,
    overlay,
    ...textBlock(ctx, {
      x: M,
      width: W - 2 * M,
      top,
      bottom,
      anchor: slide.textPosition === "top" ? "top" : slide.textPosition === "center" ? "center" : "bottom",
      align: slide.textPosition === "center" ? "center" : "left",
      background: shade,
      kicker: slide.kicker,
      title: slide.title,
      body: slide.body,
      cta: slide.cta,
      maxTitle: 108,
    }),
    ...chrome(ctx, shade, { swipe: slide.swipeHint && !isLast, logo: true })
  );
  imageJob(ctx, page, bg, "background");
}

function splitPage(ctx: Ctx, slide: SlidePlan, page: StudioPage, isLast: boolean) {
  const { W, H, M } = ctx;
  const bgColor = slide.tone === "light" ? ctx.palette.light : ctx.palette.dark;
  page.background = bgColor;
  const cardW = W - 2 * M;
  const cardH = Math.round(Math.min(cardW * 0.75, H * 0.48));
  const imageOnTop = slide.textPosition !== "top";
  const cardY = imageOnTop ? M + 110 : H - M - 70 - cardH;

  const card = makeImageLayer({
    name: "Foto",
    role: "photo",
    x: M,
    y: cardY,
    width: cardW,
    height: cardH,
    radius: 36,
    prompt: slide.backgroundPrompt ? backgroundPrompt(ctx, slide.backgroundPrompt, "") : null,
    status: slide.backgroundPrompt ? "generating" : null,
  });

  const top = imageOnTop ? cardY + cardH + 64 : M + 130;
  const bottom = imageOnTop ? H - M - 70 : cardY - 56;
  page.layers.push(
    card,
    ...textBlock(ctx, {
      x: M,
      width: cardW,
      top,
      bottom,
      anchor: imageOnTop ? "top" : "bottom",
      align: "left",
      background: bgColor,
      kicker: slide.kicker,
      title: slide.title,
      body: slide.body,
      cta: slide.cta,
      maxTitle: 80,
      minTitle: 44,
    }),
    ...chrome(ctx, bgColor, { swipe: slide.swipeHint && !isLast, logo: true })
  );
  imageJob(ctx, page, card, "background");
}

function statementPage(ctx: Ctx, slide: SlidePlan, page: StudioPage, isLast: boolean) {
  const { W, H, M } = ctx;
  const bgColor = slide.tone === "light" ? ctx.palette.light : ctx.palette.dark;
  page.background = bgColor;
  // Degradê sutil para o fundo sólido não ficar chapado.
  page.gradient = {
    angle: 155,
    stops: [
      { color: bgColor, opacity: 1, at: 0 },
      { color: bgColor, opacity: 1, at: 55 },
      { color: ctx.palette.primary, opacity: contrast(ctx.palette.primary, bgColor) > 1.6 ? 0.55 : 0.25, at: 100 },
    ],
  };

  const glow = makeShapeLayer({
    name: "Detalhe",
    shape: "ellipse",
    x: W - 420,
    y: -260,
    width: 720,
    height: 720,
    fill: ctx.palette.accent,
    opacity: 0.14,
  });

  const centered = slide.textPosition === "center";
  const bar = makeShapeLayer({
    name: "Barra de destaque",
    width: 120,
    height: 12,
    radius: 6,
    fill: textColorsOn(ctx, bgColor).accent,
    x: centered ? Math.round((W - 120) / 2) : M,
    y: 0,
  });

  const layers: StudioLayer[] = [glow];
  let element: StudioImageLayer | null = null;
  if (slide.elementPrompt) {
    const size = Math.round(W * 0.42);
    element = makeImageLayer({
      name: "Elemento",
      role: "element",
      fit: "contain",
      width: size,
      height: size,
      x: slide.elementSide === "left" ? M - 20 : W - M - size + 20,
      y: slide.textPosition === "top" ? H - M - size - 40 : M + 90,
      prompt: elementPrompt(ctx, slide.elementPrompt),
      status: "generating",
    });
    layers.push(element);
  }

  const top = M + 150 + (element && slide.textPosition !== "top" ? Math.round(W * 0.3) : 0);
  const bottom = H - M - 80 - (element && slide.textPosition === "top" ? Math.round(W * 0.38) : 0);
  const text = textBlock(ctx, {
    x: M,
    width: W - 2 * M,
    top,
    bottom,
    anchor: slide.textPosition === "top" ? "top" : slide.textPosition === "center" ? "center" : "bottom",
    align: centered ? "center" : "left",
    background: bgColor,
    kicker: slide.kicker,
    title: slide.title,
    body: slide.body,
    cta: slide.cta,
    maxTitle: 128,
  });
  const first = text[0];
  if (first && !slide.kicker) {
    bar.y = first.y - 44;
    layers.push(bar);
  }
  page.layers.push(...layers, ...text, ...chrome(ctx, bgColor, { swipe: slide.swipeHint && !isLast, logo: true }));
  if (element) imageJob(ctx, page, element, "element");
}

function featurePage(ctx: Ctx, slide: SlidePlan, page: StudioPage, isLast: boolean) {
  const { W, H, M } = ctx;
  const bgColor = slide.tone === "light" ? ctx.palette.light : ctx.palette.dark;
  page.background = bgColor;
  const size = Math.round(Math.min(W * 0.66, H * 0.48));
  const elementBottom = slide.textPosition !== "bottom";
  const ex = slide.elementSide === "left" ? M - 30 : W - size - M + 30;
  const ey = elementBottom ? H - size - M - 40 : M + 90;

  const glow = makeShapeLayer({
    name: "Brilho",
    shape: "ellipse",
    x: ex + size * 0.1,
    y: ey + size * 0.1,
    width: size * 0.8,
    height: size * 0.8,
    fill: ctx.palette.accent,
    opacity: 0.22,
  });
  const element = makeImageLayer({
    name: "Elemento",
    role: "element",
    fit: "contain",
    x: ex,
    y: ey,
    width: size,
    height: size,
    shadow: true,
    prompt: slide.elementPrompt ? elementPrompt(ctx, slide.elementPrompt) : null,
    status: slide.elementPrompt ? "generating" : null,
  });

  const top = elementBottom ? M + 140 : ey + size + 40;
  const bottom = elementBottom ? ey - 30 : H - M - 70;
  page.layers.push(
    glow,
    element,
    ...textBlock(ctx, {
      x: M,
      width: W - 2 * M,
      top,
      bottom,
      anchor: elementBottom ? "top" : "bottom",
      align: "left",
      background: bgColor,
      kicker: slide.kicker,
      title: slide.title,
      body: slide.body,
      cta: slide.cta,
      maxTitle: 92,
      minTitle: 44,
    }),
    ...chrome(ctx, bgColor, { swipe: slide.swipeHint && !isLast, logo: true })
  );
  imageJob(ctx, page, element, "element");
}

function ctaPage(ctx: Ctx, slide: SlidePlan, page: StudioPage) {
  const { W, H, M } = ctx;
  const shade = slide.tone === "light" ? ctx.palette.light : ctx.palette.dark;
  page.background = shade;
  const layers: StudioLayer[] = [];

  if (slide.backgroundPrompt) {
    const bg = makeImageLayer({
      name: "Imagem de fundo",
      role: "background",
      width: W,
      height: H,
      prompt: backgroundPrompt(ctx, slide.backgroundPrompt, "no centro"),
      status: "generating",
    });
    layers.push(bg, makeShapeLayer({ name: "Película", locked: true, width: W, height: H, fill: shade, opacity: 0.68 }));
    imageJob(ctx, page, bg, "background");
  } else {
    page.gradient = {
      angle: 180,
      stops: [
        { color: shade, opacity: 1, at: 0 },
        { color: ctx.palette.primary, opacity: 0.4, at: 100 },
      ],
    };
    layers.push(
      makeShapeLayer({
        name: "Detalhe",
        shape: "ellipse",
        x: -300,
        y: H - 520,
        width: 900,
        height: 900,
        fill: ctx.palette.accent,
        opacity: 0.12,
      })
    );
  }

  if (ctx.brand.logoUrl) {
    layers.push(
      makeImageLayer({
        name: "Logo",
        role: "logo",
        src: ctx.brand.logoUrl,
        fit: "contain",
        x: Math.round((W - 300) / 2),
        y: M + 10,
        width: 300,
        height: 110,
      })
    );
  }

  layers.push(
    ...textBlock(ctx, {
      x: M,
      width: W - 2 * M,
      top: M + 180,
      bottom: H - M - 80,
      anchor: "center",
      align: "center",
      background: shade,
      kicker: slide.kicker,
      title: slide.title,
      body: slide.body,
      cta: slide.cta || "Fale com a gente",
      maxTitle: 104,
    })
  );

  if (ctx.brand.handle) {
    const { text } = textColorsOn(ctx, shade);
    layers.push(
      makeTextLayer({
        name: "@ do cliente",
        x: M,
        y: H - M - 30,
        width: W - 2 * M,
        height: 36,
        text: ctx.brand.handle.startsWith("@") ? ctx.brand.handle : `@${ctx.brand.handle}`,
        fontFamily: ctx.body.family,
        fontSize: 28,
        fontWeight: 600,
        color: text,
        accentColor: text,
        align: "center",
        lineHeight: 1.25,
        opacity: 0.8,
      })
    );
  }
  page.layers.push(...layers);
}

// ─── Entrada ─────────────────────────────────────────────────────────────────

export function resolvePalette(plan: DesignPlan, brand: StudioBrandKit): Palette {
  const derived = deriveRoles(brand.palette);
  const palette = {
    dark: cleanHex(plan.colors?.dark, derived.dark),
    light: cleanHex(plan.colors?.light, derived.light),
    primary: cleanHex(plan.colors?.primary, derived.primary),
    accent: cleanHex(plan.colors?.accent, derived.accent),
  };
  // Escuro e claro precisam contrastar entre si — senão nenhum texto lê.
  if (contrast(palette.dark, palette.light) < 4.5) {
    palette.dark = "#0b0b0f";
    palette.light = "#f7f5f0";
  }
  return palette;
}

export function buildStudioDocument(params: {
  plan: DesignPlan;
  brand: StudioBrandKit;
  format: StudioFormat;
}): { document: StudioDocument; jobs: StudioImageJob[] } {
  const size = STUDIO_FORMATS[params.format];
  const brandHeading = params.brand.fontHeading;
  const heading = studioFontById(params.plan.fontHeading);
  const body = studioFontById(params.plan.fontBody);
  const ctx: Ctx = {
    W: size.width,
    H: size.height,
    M: 88,
    palette: resolvePalette(params.plan, params.brand),
    // Fonte do perfil de design do cliente tem prioridade sobre a escolha da IA.
    heading: brandHeading ? { ...heading, family: brandHeading } : heading,
    body: params.brand.fontBody ? { ...body, family: params.brand.fontBody } : body,
    brand: params.brand,
    index: 0,
    total: params.plan.slides.length,
    imageStyle: params.plan.imageStyle ?? "",
    jobs: [],
  };

  const pages = params.plan.slides.map((slide, index) => {
    ctx.index = index;
    const isLast = index === params.plan.slides.length - 1;
    const page = makePage({ name: `Página ${index + 1}` });
    switch (slide.layout) {
      case "split":
        splitPage(ctx, slide, page, isLast);
        break;
      case "statement":
        statementPage(ctx, slide, page, isLast);
        break;
      case "feature":
        if (slide.elementPrompt) featurePage(ctx, slide, page, isLast);
        else statementPage(ctx, slide, page, isLast);
        break;
      case "cta":
        ctaPage(ctx, slide, page);
        break;
      default:
        if (slide.backgroundPrompt) heroPage(ctx, slide, page, isLast);
        else statementPage(ctx, slide, page, isLast);
    }
    return page;
  });

  return {
    document: { version: 1, format: params.format, width: size.width, height: size.height, pages },
    jobs: ctx.jobs,
  };
}
