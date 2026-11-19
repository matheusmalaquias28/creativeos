import { describe, expect, it } from "vitest";
import { buildCaption, buildCardPrompt, EXACT_TEXT_RULE, expectedTexts } from "../prompts";
import { matchAccount, normalizeUsername } from "../runs";
import { createRunSchema, scheduledAtProblem } from "../request";
import { isStale } from "../shape";

const plan = {
  styleGuide: "Fundo verde escuro #012813, títulos brancos em serifa forte.",
  cards: [
    { texts: ["3 sinais de que seu tráfego queima dinheiro"], cta: null, visual: "Capa com foto de celular." },
    { texts: ["Você não sabe seu custo por venda", "Sem esse número, tudo parece bom."], cta: null, visual: "Gráfico." },
    { texts: ["Quer o checklist?"], cta: "Comente TRÁFEGO", visual: "Fechamento." },
  ],
};

describe("buildCardPrompt", () => {
  it("usa a frase exata e lista só os textos do card", () => {
    const p = buildCardPrompt({ plan, index: 1, hasLogo: true, coverAsReference: true, profileReferenceCount: 0 });
    expect(p).toContain(EXACT_TEXT_RULE);
    expect(p).toContain('"Você não sabe seu custo por venda"');
    expect(p).toContain('"Sem esse número, tudo parece bom."');
    expect(p).not.toContain("3 sinais");
    expect(p).toContain(plan.styleGuide);
  });

  it("CTA vira botão centralizado embaixo", () => {
    const p = buildCardPrompt({ plan, index: 2, hasLogo: false, coverAsReference: true, profileReferenceCount: 0 });
    expect(p).toContain('"Comente TRÁFEGO" (botão de CTA)');
    expect(p).toMatch(/BOTÃO com fundo de cor sólida, SEMPRE centralizado na parte inferior/);
    expect(p).toContain("o ÚLTIMO card");
  });

  it("a logo vai como referência para a IA aplicar, sem o fundo branco", () => {
    const p = buildCardPrompt({ plan, index: 0, hasLogo: true, coverAsReference: false, profileReferenceCount: 0 });
    expect(p).toContain("Imagem 1 é a LOGO da marca: aplique exatamente esta logo");
    expect(p).toContain("canto superior esquerdo");
    expect(p).toContain("NÃO reproduza esse fundo");
    expect(p).not.toContain("será aplicada ali depois");
    expect(p).toContain("a CAPA");
  });

  it("numera as referências: capa, logo e depois as do perfil", () => {
    const all = buildCardPrompt({ plan, index: 1, hasLogo: true, coverAsReference: true, profileReferenceCount: 2 });
    expect(all).toContain("Imagem 1 é a CAPA");
    expect(all).toContain("Imagem 2 é a LOGO");
    expect(all).toContain("Imagens 3 a 4 são referências");
    const cover = buildCardPrompt({ plan, index: 0, hasLogo: false, coverAsReference: false, profileReferenceCount: 1 });
    expect(cover).not.toContain("é a CAPA deste");
    expect(cover).not.toContain("LOGO");
    expect(cover).toContain("Imagem 1 é referência");
  });

  it("leva o ajuste pedido no refazer", () => {
    const p = buildCardPrompt({
      plan,
      index: 1,
      hasLogo: false,
      coverAsReference: true,
      profileReferenceCount: 0,
      instruction: "título maior",
    });
    expect(p).toContain("AJUSTE PEDIDO PARA ESTE CARD (prioridade): título maior");
  });
});

describe("expectedTexts", () => {
  it("inclui o CTA e tira travessão", () => {
    const p = { cards: [{ texts: ["Antes — depois"], cta: "Salve", visual: "" }] };
    expect(expectedTexts(p, 0)).toEqual(["Antes, depois", "Salve"]);
  });
});

describe("buildCaption", () => {
  it("junta legenda e hashtags sem repetir nem duplicar #", () => {
    const c = buildCaption({ caption: "Linha 1\n\nLinha 2 — fim", hashtags: ["#marketing", "marketing", "tráfego pago", ""] });
    expect(c).toBe("Linha 1\n\nLinha 2, fim\n\n#marketing #tráfegopago");
  });

  it("limita a 30 hashtags e 2.200 caracteres", () => {
    const tags = Array.from({ length: 40 }, (_, i) => `tag${i}`);
    const c = buildCaption({ caption: "x".repeat(3000), hashtags: tags });
    expect(c.length).toBeLessThanOrEqual(2200);
    const short = buildCaption({ caption: "oi", hashtags: tags });
    expect(short.match(/#/g)?.length).toBe(30);
  });
});

describe("matchAccount", () => {
  const accounts = [
    { igUserId: "1", username: "previtasbrasil_" },
    { igUserId: "2", username: "outra" },
  ];
  it("casa o @ do perfil com a conta conectada, sem @ e sem caixa", () => {
    expect(matchAccount(accounts, "@PrevitasBrasil_")?.igUserId).toBe("1");
    expect(matchAccount(accounts, "outra")?.igUserId).toBe("2");
    expect(matchAccount(accounts, "@naoexiste")).toBeNull();
    expect(matchAccount(accounts, null)).toBeNull();
    expect(normalizeUsername("  @@Foo ")).toBe("foo");
  });
});

describe("pedido do agente", () => {
  it("exige perfil e conteúdo", () => {
    expect(createRunSchema.safeParse({ content: "tema bom" }).success).toBe(false);
    const ok = createRunSchema.safeParse({ instagram: "@previtasbrasil_", content: "tema bom" });
    expect(ok.success && ok.data.mode).toBe("ai");
  });

  it("só aceita callback https", () => {
    const base = { instagram: "x", content: "tema bom" };
    expect(createRunSchema.safeParse({ ...base, callbackUrl: "http://a.com/h" }).success).toBe(false);
    expect(createRunSchema.safeParse({ ...base, callbackUrl: "https://a.com/h" }).success).toBe(true);
  });

  it("valida o horário pedido", () => {
    const now = Date.parse("2026-11-18T12:00:00Z");
    expect(scheduledAtProblem("2026-11-18T11:00:00Z", now)).toMatch(/futuro/);
    expect(scheduledAtProblem("2026-11-19T12:00:00-03:00", now)).toBeNull();
    expect(scheduledAtProblem("2027-03-01T12:00:00Z", now)).toMatch(/75 dias/);
  });
});

describe("isStale", () => {
  it("só gerações paradas há mais de 6 min", () => {
    const now = Date.parse("2026-11-18T12:10:00Z");
    expect(isStale({ status: "generating", generation_started_at: "2026-11-18T12:00:00Z" }, now)).toBe(true);
    expect(isStale({ status: "generating", generation_started_at: "2026-11-18T12:08:00Z" }, now)).toBe(false);
    expect(isStale({ status: "awaiting_approval", generation_started_at: "2026-11-18T12:00:00Z" }, now)).toBe(false);
  });
});

import { buildPlanSystemPrompt } from "../prompts";
import { fitTweetFontSize, parseTweetText, wordText } from "../tweet-layout";

const profileForPrompt = {
  name: "Previtas",
  color_background: "#000000",
  color_title: "#ffffff",
  color_subtitle: "#aaaaaa",
  color_accent: "#1d9bf0",
  palette: [],
  font_title: null,
  font_body: null,
  context_md: null,
  business_context: null,
  instagram_handle: "@previtasbrasil_",
};

describe("formatos", () => {
  it("arte única: plano de 1 card e prompt sem cara de carrossel", () => {
    const sys = buildPlanSystemPrompt(profileForPrompt, "ai", 5, "single");
    expect(sys).toContain("EXATAMENTE 1 card");
    expect(sys).not.toContain("EXATAMENTE 5 cards");
    const p = buildCardPrompt({ plan: { styleGuide: "x", cards: [plan.cards[0]] }, index: 0, format: "single", hasLogo: false, coverAsReference: false, profileReferenceCount: 0 });
    expect(p).toContain("post único");
    expect(p).not.toContain("carrossel de");
    expect(p).toContain(EXACT_TEXT_RULE);
  });

  it("tweet: plano pede texto único por card, na voz do perfil", () => {
    const sys = buildPlanSystemPrompt(profileForPrompt, "ai", 6, "tweet");
    expect(sys).toContain('"texts" tem UM item');
    expect(sys).toContain("Previtas (@previtasbrasil_)");
    expect(sys).toContain("exatamente 6 cards");
  });
});

describe("card tweet", () => {
  it("separa parágrafos e marca o negrito por palavra", () => {
    const paras = parseTweetText("Quem fala **primeiro perde**.\n\nSegundo parágrafo");
    expect(paras).toHaveLength(2);
    expect(paras[0].map(wordText)).toEqual(["Quem", "fala", "primeiro", "perde."]);
    // a pontuação colada no negrito fica na mesma palavra, sem espaço
    expect(paras[0][3].parts).toEqual([
      { text: "perde", bold: true },
      { text: ".", bold: false },
    ]);
    expect(paras[0][2].parts).toEqual([{ text: "primeiro", bold: true }]);
  });

  it("texto curto usa a fonte máxima; texto longo encolhe sem passar do mínimo", () => {
    expect(fitTweetFontSize(parseTweetText("Curto."))).toBe(46);
    const long = parseTweetText(Array.from({ length: 6 }, () => "palavra ".repeat(40)).join("\n\n"));
    const size = fitTweetFontSize(long);
    expect(size).toBeLessThan(46);
    expect(size).toBeGreaterThanOrEqual(24);
  });
});

import { dailyImageLimit, estimatedImages, maxActiveRuns } from "../limits";

describe("freios de gasto", () => {
  it("tweet não gasta imagem; arte única gasta 1; carrossel o número de cards", () => {
    expect(estimatedImages("tweet", 6)).toBe(0);
    expect(estimatedImages("single", null)).toBe(1);
    expect(estimatedImages("carousel", 5)).toBe(5);
    expect(estimatedImages("carousel", null)).toBe(7);
  });

  it("limites vêm do env, com padrão seguro", () => {
    const keep = { d: process.env.CAROUSEL_AGENT_DAILY_IMAGE_LIMIT, a: process.env.CAROUSEL_AGENT_MAX_ACTIVE };
    delete process.env.CAROUSEL_AGENT_DAILY_IMAGE_LIMIT;
    delete process.env.CAROUSEL_AGENT_MAX_ACTIVE;
    expect(dailyImageLimit()).toBe(40);
    expect(maxActiveRuns()).toBe(2);
    process.env.CAROUSEL_AGENT_DAILY_IMAGE_LIMIT = "15";
    process.env.CAROUSEL_AGENT_MAX_ACTIVE = "abc";
    expect(dailyImageLimit()).toBe(15);
    expect(maxActiveRuns()).toBe(2);
    if (keep.d === undefined) delete process.env.CAROUSEL_AGENT_DAILY_IMAGE_LIMIT;
    else process.env.CAROUSEL_AGENT_DAILY_IMAGE_LIMIT = keep.d;
    if (keep.a === undefined) delete process.env.CAROUSEL_AGENT_MAX_ACTIVE;
    else process.env.CAROUSEL_AGENT_MAX_ACTIVE = keep.a;
  });
});

import { applyCardVisuals, buildPlanInput, CLEAN_COMPOSITION_RULE, visualRules } from "../prompts";
import { runFieldsFromBody } from "../request";

describe("direção visual", () => {
  const profile = {
    name: "Previtas",
    color_background: "#0b2545",
    color_title: "#ffffff",
    color_subtitle: "#cfd8e3",
    color_accent: "#f2b134",
    palette: [],
    font_title: null,
    font_body: null,
    context_md: null,
    business_context: null,
    instagram_handle: "@previtas",
  };

  it("o plano tem padrão editorial e proíbe elemento solto", () => {
    const sys = buildPlanSystemPrompt(profile, "ai", 6, "carousel");
    expect(sys).toContain("layout editorial e tipográfico");
    expect(sys).toContain("LITERALMENTE o assunto");
    expect(sys).not.toContain("DIREÇÃO DE ARTE DO PEDIDO");
  });

  it("a direção do pedido entra no plano e em cada card", () => {
    const sys = buildPlanSystemPrompt(profile, "ai", 6, "carousel", "Fundo azul liso, sem foto.");
    expect(sys).toContain("DIREÇÃO DE ARTE DO PEDIDO");
    expect(sys).toContain("Fundo azul liso, sem foto.");
    expect(visualRules("  ")).not.toContain("DIREÇÃO DE ARTE DO PEDIDO");
    const card = buildCardPrompt({
      plan,
      index: 1,
      hasLogo: false,
      coverAsReference: false,
      profileReferenceCount: 0,
      visualDirection: "Fundo azul liso, sem foto.",
    });
    expect(card).toContain("DIREÇÃO DE ARTE DO PEDIDO (prioridade sobre o guia de estilo):\nFundo azul liso, sem foto.");
    expect(card).toContain(CLEAN_COMPOSITION_RULE);
  });

  it("visual por card vai no input do plano e vale ao pé da letra", () => {
    const input = buildPlanInput("manual", "Card 1:\nA\n\nCard 2:\nB", "carousel", ["Foto de carteira de trabalho", null]);
    expect(input).toContain("Card 1: Foto de carteira de trabalho");
    expect(input).toContain("Card 2: (livre");
    expect(buildPlanInput("manual", "x", "tweet", ["foto"])).not.toContain("Direção visual");
    const cards = applyCardVisuals(
      [
        { texts: ["A"], cta: null, visual: "Foto genérica de escritório" },
        { texts: ["B"], cta: null, visual: "Sem imagem, número grande" },
      ],
      ["Foto de carteira de trabalho", null]
    );
    expect(cards[0].visual).toBe("Foto de carteira de trabalho");
    expect(cards[1].visual).toBe("Sem imagem, número grande");
  });

  it("pedido com cards vira manual, 1 card por item", () => {
    const body = createRunSchema.parse({
      instagram: "@previtas",
      cards: [{ text: "Capa", visual: "Foto de um aposentado brasileiro" }, { text: "Fim" }],
      visualDirection: "Sem ícones.",
      content: "Pauta: INSS",
    });
    const f = runFieldsFromBody(body);
    expect(f.mode).toBe("manual");
    expect(f.cardCount).toBe(2);
    expect(f.input).toContain("Card 1:\nCapa");
    expect(f.input).toContain("Contexto do pedido");
    expect(f.options).toEqual({
      visualDirection: "Sem ícones.",
      frame: true,
      cardVisuals: ["Foto de um aposentado brasileiro", null],
    });
  });

  it("valida cards e content", () => {
    expect(createRunSchema.safeParse({ instagram: "@x" }).success).toBe(false);
    expect(createRunSchema.safeParse({ instagram: "@x", cards: [{ text: "só um" }] }).success).toBe(false);
    expect(createRunSchema.safeParse({ instagram: "@x", format: "single", cards: [{ text: "só um" }] }).success).toBe(true);
    const tweet = runFieldsFromBody(
      createRunSchema.parse({ instagram: "@x", format: "tweet", content: "tema", visualDirection: "ignorado" })
    );
    expect(tweet.options).toEqual({ theme: "light" });
  });
});

import { bandColor, inkFor, progressFill } from "../brand-frame-layout";
import { FOOTER_RESERVED_RULE } from "../prompts";

describe("rodapé fixo da marca", () => {
  it("barra de progresso cresce card a card e fecha cheia no último", () => {
    expect(progressFill(0, 6, 360)).toBe(60);
    expect(progressFill(2, 6, 360)).toBe(180);
    expect(progressFill(5, 6, 360)).toBe(360);
    expect(progressFill(0, 1, 360)).toBe(360);
  });

  it("tinta branca em fundo escuro, cor escura da marca em fundo claro", () => {
    expect(inkFor({ r: 10, g: 40, b: 50 }, ["#0b3b45"])).toBe("#ffffff");
    expect(inkFor({ r: 250, g: 250, b: 250 }, ["#ff6a13", "#0b3b45"])).toBe("#0b3b45");
    expect(inkFor({ r: 250, g: 250, b: 250 }, ["#ff6a13"])).toBe("#15202b");
  });

  it("o prompt reserva a faixa de baixo só quando o rodapé está ligado", () => {
    const on = buildCardPrompt({ plan, index: 2, hasLogo: false, coverAsReference: true, profileReferenceCount: 1, reserveFooter: true });
    expect(on).toContain(FOOTER_RESERVED_RULE);
    expect(on).toContain("com margem da borda de baixo");
    expect(on).toContain("formato 9:10");
    expect(on).toContain("Não reproduza o rodapé delas");
    const off = buildCardPrompt({ plan, index: 2, hasLogo: false, coverAsReference: true, profileReferenceCount: 0 });
    expect(off).not.toContain("RODAPÉ:");
    expect(off).toContain("formato vertical 4:5");
  });

  it("faixa lisa usa a média exata; faixa com conteúdo usa a dominante", () => {
    const ch = (mean: number, stdev: number) => ({ mean, stdev });
    const dominant = { r: 8, g: 56, b: 72 };
    expect(bandColor({ channels: [ch(11, 1), ch(59, 1), ch(69, 1)], dominant })).toEqual({ r: 11, g: 59, b: 69 });
    expect(bandColor({ channels: [ch(90, 60), ch(80, 50), ch(70, 40)], dominant })).toEqual(dominant);
  });

  it("brandFrame: false desliga", () => {
    const f = runFieldsFromBody(createRunSchema.parse({ instagram: "@x", content: "tema", brandFrame: false }));
    expect(f.options.frame).toBe(false);
  });
});

import { chooseLogo, contrastRatio, logoPlacement, LOGO_MAX_HEIGHT, LOGO_TOP } from "../logo-layout";
import { TOP_RESERVED_RULE } from "../prompts";

describe("logo aplicada em código", () => {
  const variants = [
    { key: "primary", lum: 0.07, uploaded: true },
    { key: "white", lum: 1, uploaded: false },
    { key: "dark", lum: 0.02, uploaded: false },
  ];

  it("auto: enviada em fundo claro, branca gerada em fundo escuro", () => {
    expect(chooseLogo(variants, 0.95).key).toBe("primary");
    expect(chooseLogo(variants, 0.03).key).toBe("white");
  });

  it("auto prefere a logo clara enviada à branca gerada", () => {
    const withLight = [...variants, { key: "light", lum: 0.7, uploaded: true }];
    expect(chooseLogo(withLight, 0.03).key).toBe("light");
  });

  it("light/dark forçados pelo agente", () => {
    expect(chooseLogo(variants, 0.95, "light").key).toBe("white");
    expect(chooseLogo(variants, 0.03, "dark").key).toBe("primary");
  });

  it("mesma posição em todos os cards, centro vertical fixo", () => {
    const a = logoPlacement("top-center", { width: 300, height: 89 }, 1080);
    expect(a.left).toBe(390);
    expect(Math.abs(a.top + 89 / 2 - (LOGO_TOP + LOGO_MAX_HEIGHT / 2))).toBeLessThanOrEqual(1);
    expect(logoPlacement("top-left", { width: 200, height: 100 }, 1080)).toEqual({ left: 64, top: LOGO_TOP });
    expect(logoPlacement("top-right", { width: 200, height: 100 }, 1080).left).toBe(1080 - 64 - 200);
    expect(contrastRatio(1, 0)).toBeCloseTo(21, 0);
  });

  it("o prompt reserva o topo e não manda desenhar logo", () => {
    const p = buildCardPrompt({ plan, index: 1, hasLogo: false, coverAsReference: true, profileReferenceCount: 1, reserveTop: true });
    expect(p).toContain(TOP_RESERVED_RULE);
    expect(p).toContain("Não copie a logo da capa");
    expect(p).toContain("Não reproduza a logo delas");
    expect(p).toContain("Não desenhe logo");
  });

  it("agente controla logo e posição", () => {
    const f = runFieldsFromBody(createRunSchema.parse({ instagram: "@x", content: "tema", logo: "light", logoPosition: "top-left" }));
    expect(f.options).toMatchObject({ logo: "light", logoPosition: "top-left" });
    const off = runFieldsFromBody(createRunSchema.parse({ instagram: "@x", content: "tema", logo: false }));
    expect(off.options.logo).toBe(false);
    expect(createRunSchema.safeParse({ instagram: "@x", content: "tema", logo: "branca" }).success).toBe(false);
  });
});

import { logoOnCard } from "../logo-layout";

describe("logo só na capa e no último card", () => {
  it("edges (padrão): primeiro e último; all: todos; arte única: o único card", () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => logoOnCard(i, 6))).toEqual([true, false, false, false, false, true]);
    expect([0, 1, 2].map((i) => logoOnCard(i, 3, "all"))).toEqual([true, true, true]);
    expect(logoOnCard(0, 1)).toBe(true);
  });

  it("cards do meio não copiam a logo da capa", () => {
    const p = buildCardPrompt({ plan, index: 1, hasLogo: false, coverAsReference: true, profileReferenceCount: 0 });
    expect(p).toContain("Não copie a logo da capa.");
    expect(p).not.toContain("FAIXA RESERVADA NO TOPO");
  });

  it("agente escolhe logoCards", () => {
    const f = runFieldsFromBody(createRunSchema.parse({ instagram: "@x", content: "tema", logoCards: "all" }));
    expect(f.options.logoCards).toBe("all");
  });
});

import { splitStudioText } from "@/lib/carousel-studio/server-text";
import { placeImage } from "@/lib/carousel-studio/server-image";
import { studioCardsToArtes, pageTexts } from "../studio-shape";

describe("formato studio", () => {
  it("texto do Studio em palavras, com destaque grudado na pontuação", () => {
    const [p1, p2] = splitStudioText("Aposentadoria *negada pelo INSS*?\nVeja");
    expect(p1.map((w) => w.map((x) => `${x.accent ? "*" : ""}${x.text}`).join(""))).toEqual([
      "Aposentadoria",
      "*negada",
      "*pelo",
      "*INSS?",
    ]);
    expect(p1[3]).toEqual([{ text: "INSS", accent: true }, { text: "?", accent: false }]);
    expect(p2).toEqual([[{ text: "Veja", accent: false }]]);
    expect(splitStudioText("a\n\nb")[1]).toEqual([]);
    expect(splitStudioText("ação", true)[0][0][0].text).toBe("AÇÃO");
  });

  it("imagem: cover centraliza e corta; contain cabe inteira; zoom a partir do foco", () => {
    expect(placeImage({ boxW: 100, boxH: 100, imgW: 200, imgH: 100, fit: "cover", focusX: 50, focusY: 50, zoom: 1 })).toEqual({
      left: -50, top: 0, width: 200, height: 100,
    });
    expect(placeImage({ boxW: 100, boxH: 100, imgW: 200, imgH: 100, fit: "contain", focusX: 50, focusY: 50, zoom: 3 })).toEqual({
      left: 0, top: 25, width: 100, height: 50,
    });
    const z = placeImage({ boxW: 100, boxH: 100, imgW: 100, imgH: 100, fit: "cover", focusX: 0, focusY: 0, zoom: 2 });
    expect(z).toEqual({ left: 0, top: 0, width: 200, height: 200 });
  });

  it("cards do agente viram artes do briefing (CTA na última linha do último card)", () => {
    const artes = studioCardsToArtes([
      { text: "Título 1\nApoio 1", visual: "foto de idosa", template: "M1" },
      { text: "Fecho\nApoio\nFale com a Previtas" },
    ]);
    expect(artes[0]).toMatchObject({ headline: "Título 1", subheadline: "Apoio 1", cta: "", observacaoVisual: "Use o modelo M1. foto de idosa" });
    expect(artes[1]).toMatchObject({ headline: "Fecho", subheadline: "Apoio", cta: "Fale com a Previtas" });
  });

  it("pedido studio exige styleId e cards; sem rodapé/logo do agente", () => {
    expect(createRunSchema.safeParse({ instagram: "@x", format: "studio", cards: [{ text: "a" }, { text: "b" }] }).success).toBe(false);
    const body = createRunSchema.parse({
      instagram: "@x",
      format: "studio",
      styleId: "cc3baa8e-a2a4-4de2-9375-650ee01f9f50",
      cards: [{ text: "a", template: "m2" }, { text: "b" }],
    });
    const f = runFieldsFromBody(body);
    expect(f.options).toMatchObject({ styleId: body.styleId, frame: false, logo: false });
    expect(f.options.studioCards?.[0].template).toBe("M2");
    expect(createRunSchema.safeParse({ ...body, cards: [{ text: "a", template: "capa" }, { text: "b" }] }).success).toBe(false);
  });

  it("textos da página na ordem de leitura, sem marcadores de destaque", () => {
    const base = { name: "", rotation: 0, opacity: 1, width: 100, height: 50, x: 0 };
    const page = {
      id: "p", name: "P", background: "#fff",
      layers: [
        { ...base, id: "b", type: "button", y: 900, text: "Saiba mais" },
        { ...base, id: "t2", type: "text", y: 400, text: "apoio" },
        { ...base, id: "t1", type: "text", y: 100, text: "Título *forte*" },
        { ...base, id: "h", type: "text", y: 50, text: "oculto", hidden: true },
      ],
    } as never;
    expect(pageTexts(page)).toEqual({ texts: ["Título forte", "apoio"], cta: "Saiba mais" });
  });
});
