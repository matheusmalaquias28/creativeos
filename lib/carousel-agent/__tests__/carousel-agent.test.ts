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
