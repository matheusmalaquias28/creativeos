/**
 * Montadores de prompt do Agente de Carrossel (puros, testados).
 *
 * Regras fixas de produto para TODO prompt de arte (ver art-prompt-copy-rules):
 *   1. a frase exata "A IMAGEM DEVE CONTER SOMENTE ESSES TEXTOS, NADA MAIS:";
 *   2. CTA é um BOTÃO de cor sólida, centralizado na parte de baixo.
 */

import type { CarouselProfile } from "@/types/carousel-profile";
import { stripTravessao } from "@/lib/text/strip-dash";
import type { AgentFormat, AgentPlan, AgentRunMode } from "./types";

export const EXACT_TEXT_RULE = "A IMAGEM DEVE CONTER SOMENTE ESSES TEXTOS, NADA MAIS:";

/**
 * Faixa de baixo reservada: o rodapé da marca (barra de progresso, @, ícones)
 * é desenhado em código depois (brand-frame.tsx), igual em todos os cards.
 */
export const FOOTER_RESERVED_RULE =
  "FAIXA RESERVADA NO RODAPÉ: os últimos 11% da altura da arte (a faixa de baixo, de ponta a ponta) ficam VAZIOS, só com a cor de fundo lisa: sem textos, botões, ícones, barra de progresso, @, redes sociais, foto ou qualquer elemento. O rodapé da marca é aplicado ali depois, automaticamente. Todo o conteúdo, inclusive o CTA, fica acima dessa faixa.";

/**
 * Topo reservado: a logo da marca é colada em código depois (logo.ts), na
 * versão que contrasta com o fundo.
 */
export const TOP_RESERVED_RULE =
  "FAIXA RESERVADA NO TOPO: os primeiros 14% da altura da arte (a faixa de cima, de ponta a ponta) ficam sem textos, títulos, botões, molduras ou elementos gráficos; a foto ou o fundo podem continuar ali normalmente. A logo da marca é aplicada ali depois, automaticamente: NÃO desenhe logo nenhuma, nem copie a logo das imagens anexadas.";

/** Vai em todo card de imagem: nada além do que foi descrito. */
export const CLEAN_COMPOSITION_RULE =
  "COMPOSIÇÃO LIMPA: a arte tem só os textos, os elementos da identidade da marca (os do modelo/capa) e o que está descrito acima. Não acrescente ícones, formas, setas, adesivos, objetos ou enfeites que não foram pedidos. Se houver foto ou ilustração, ela mostra literalmente o assunto do card; nada de foto genérica de fundo ou cena sem relação com o texto. Se o card diz \"Sem imagem\", não coloque imagem: fundo da marca e tipografia.";


type ProfileForPrompt = Pick<
  CarouselProfile,
  | "name"
  | "color_background"
  | "color_title"
  | "color_subtitle"
  | "color_accent"
  | "palette"
  | "font_title"
  | "font_body"
  | "context_md"
  | "business_context"
  | "instagram_handle"
>;

function paletteOf(p: ProfileForPrompt): string[] {
  const base = [p.color_background, p.color_title, p.color_subtitle, p.color_accent];
  const extra = Array.isArray(p.palette) ? p.palette : [];
  return [...new Set([...base, ...extra])].filter(Boolean);
}

/**
 * Regras de direção visual do plano. O padrão é editorial/tipográfico: a IA
 * colocava imagem em todo card e inventava cena genérica a partir da copy
 * (elementos soltos, fundo sem relação com o tema).
 */
export function visualRules(visualDirection?: string | null): string {
  const rules = `DIREÇÃO VISUAL
- Padrão: layout editorial e tipográfico. Fundo da marca (cor sólida ou gradiente sutil da paleta), título forte, hierarquia clara e no máximo UM elemento de destaque por card.
- Foto ou ilustração só quando mostrar LITERALMENTE o assunto daquele card (ex.: card sobre carteira de trabalho → foto de uma carteira de trabalho). Se não dá para dizer numa frase concreta o que a imagem mostra e por que ela tem a ver com o texto, o card fica sem imagem.
- Proibido: ícones, formas, setas, adesivos, objetos 3D ou enfeites soltos que não fazem parte da identidade da marca; foto genérica de fundo (escritório, aperto de mão, pessoa sorrindo sem contexto); cena sem relação direta com o texto; estilos de imagem diferentes entre os cards.
- Bom uso: capa com uma foto forte e concreta do tema; cards do meio tipográficos; número ou dado em destaque grande no lugar de ilustração.
- No campo "visual" de cada card, descreva a composição concreta: onde fica o título, o que está em destaque e, se tiver imagem, o que ela mostra exatamente. Se for só tipografia, comece com "Sem imagem" e descreva o destaque tipográfico.`;
  const direction = visualDirection?.trim();
  if (!direction) return rules;
  return `${rules}

DIREÇÃO DE ARTE DO PEDIDO (obrigatória; quando conflitar com as regras acima, ela vence):
${direction}
O styleGuide e o "visual" de cada card precisam seguir esta direção.`;
}

export function buildPlanSystemPrompt(
  profile: ProfileForPrompt,
  mode: AgentRunMode,
  cardCount: number | null,
  format: AgentFormat = "carousel",
  visualDirection?: string | null,
  /** O rodapé (barra de progresso, @, ícones) é aplicado em código depois. */
  brandFrame = false
): string {
  if (format === "tweet") return buildTweetPlanSystemPrompt(profile, mode, cardCount);
  const single = format === "single";
  const context =
    profile.context_md?.trim() || profile.business_context?.trim() || "(Sem contexto detalhado do cliente, use bom senso.)";

  const count = single
    ? "Gere EXATAMENTE 1 card: é um post de arte única, não um carrossel."
    : cardCount
    ? `Gere EXATAMENTE ${cardCount} cards.`
    : mode === "manual"
      ? "Se o conteúdo já vier separado em cards/blocos, 1 bloco = 1 card. Senão, divida no que o texto pedir (de 3 a 10 cards)."
      : "Entre 5 e 8 cards, o que melhor contar a história.";

  const task = single
    ? mode === "manual"
      ? `O texto da arte JÁ ESTÁ ESCRITO. Use as palavras do usuário: título e no máximo 2 textos de apoio (e CTA, se houver). Se o texto for longo demais para uma arte, escolha o essencial sem reescrever e deixe o resto para a legenda.`
      : `Crie UMA arte de feed sobre o tema pedido: título com gancho forte, no máximo 2 textos de apoio curtos e CTA se fizer sentido. O aprofundamento vai na legenda.`
    : mode === "manual"
      ? `O conteúdo do carrossel JÁ ESTÁ ESCRITO. Não crie conteúdo novo: use as palavras do usuário, na ordem, só dividindo em cards e separando título e textos de apoio. Tire marcações como "Card 1:". Se houver CTA no texto, ele vai no último card.`
      : `Escreva um carrossel sobre o tema pedido: capa com gancho forte, desenvolvimento, prova e fechamento com CTA. Textos curtos: carrossel é lido em 2 segundos por card.`;

  return `Você é diretor de criação de ${single ? "posts" : "carrosséis"} de Instagram. Cada card vai ser gerado INTEIRO por um modelo de imagem (texto desenhado na arte), então o plano precisa ser claro e consistente.

CLIENTE: ${profile.name}${profile.instagram_handle ? ` (${profile.instagram_handle})` : ""}
CONTEXTO DA MARCA:
${context}

IDENTIDADE VISUAL
- Paleta (use só estas cores): ${paletteOf(profile).join(", ")}
- Fundo padrão: ${profile.color_background} · Título: ${profile.color_title} · Apoio: ${profile.color_subtitle} · Destaque: ${profile.color_accent}
- Fonte dos títulos: ${profile.font_title || "sans-serif forte"} · Fonte do corpo: ${profile.font_body || "sans-serif"}

TAREFA
${task}
${count}

REGRAS DOS TEXTOS
- Português do Brasil, no tom da marca. NUNCA use travessão (— ou –).
- Por card: 1 título curto (até ~8 palavras) e no máximo 2 textos de apoio curtos. Menos texto = menos erro na imagem.
- CTA só no último card e só se fizer sentido (ex.: "Salve este post").${single ? "\n- Numa arte única, \"último card\" é o próprio card." : ""}

GUIA DE ESTILO (styleGuide)
- Um único guia que vale para TODOS os cards, para o carrossel parecer uma peça só: fundo, paleta, tipografia descrita, posição dos textos, o elemento de destaque que se repete e, se houver foto, o estilo dela.
- Quando houver foto: pessoas, cenários e situações brasileiras, reais e ligadas ao tema.
- A logo da marca é aplicada automaticamente depois, no topo de todos os cards: não descreva logo no guia nem nos cards, e não ponha textos no topo (os primeiros 14% da altura).${
    brandFrame
      ? "\n- O rodapé (barra de progresso, @ e ícones de redes) é aplicado automaticamente depois, numa faixa lisa na parte de baixo de todos os cards: não descreva rodapé, barra de progresso, @ nem ícones de redes no guia nem nos cards, e não coloque nada nessa faixa."
      : ""
  }

${visualRules(visualDirection)}

LEGENDA
- caption: legenda pronta para o post, com quebra de linha entre parágrafos, sem hashtags.
- hashtags: de 5 a 15, sem o #.`;
}

export function buildPlanInput(
  mode: AgentRunMode,
  input: string,
  format: AgentFormat = "carousel",
  cardVisuals?: (string | null)[] | null
): string {
  const what = format === "single" ? "da arte" : "do carrossel";
  const base =
    mode === "manual"
      ? `Conteúdo ${what} (organize, sem reescrever):\n"""\n${input}\n"""`
      : `Tema ${what}:\n"""\n${input}\n"""`;
  if (format === "tweet" || !cardVisuals?.some((v) => v?.trim())) return base;
  const list = cardVisuals
    .map((v, i) => `Card ${i + 1}: ${v?.trim() || "(livre: siga a direção visual)"}`)
    .join("\n");
  return `${base}\n\nDireção visual de cada card, mandada por quem pediu (use no campo "visual" do card correspondente, sem trocar o que foi pedido; só complete a composição):\n${list}`;
}

/**
 * Depois do plano: o "visual" que o agente mandou para um card vale ao pé da
 * letra (a IA de planejamento não pode trocar por outra cena).
 */
export function applyCardVisuals<T extends { visual: string }>(cards: T[], cardVisuals?: (string | null)[] | null): T[] {
  if (!cardVisuals?.length) return cards;
  return cards.map((c, i) => {
    const wanted = cardVisuals[i]?.trim();
    return wanted ? { ...c, visual: wanted } : c;
  });
}

/**
 * Carrossel tweet: a IA só escreve o texto (o layout é desenhado em código).
 * Mesmas regras do Carrossel Tweet do app, mais legenda e hashtags. No plano,
 * cada card vira `texts: [texto]` (com **negrito** e \n\n entre parágrafos).
 */
export function buildTweetPlanSystemPrompt(
  profile: ProfileForPrompt,
  mode: AgentRunMode,
  cardCount: number | null
): string {
  const author = `${profile.name}${profile.instagram_handle ? ` (${profile.instagram_handle})` : ""}`;
  const context =
    profile.context_md?.trim() || profile.business_context?.trim() || "(Sem contexto detalhado, use bom senso.)";
  const task =
    mode === "manual"
      ? `Organize o texto do usuário em um carrossel "print de tweet" publicado por ${author}. SOMENTE divida em cards: preserve as palavras do autor, não reescreva, não resuma, não invente. Se o texto já vier separado em blocos/cards, respeite.`
      : `Escreva um carrossel no estilo "print de tweet", na voz de ${author}, em primeira pessoa, tom de conversa direta.
- Card 1: gancho forte, seguido de uma frase que promete o que vem.
- Cards do meio: uma ideia por card, com exemplo concreto, cada card puxando o próximo.
- Último card: lição principal e convite leve à ação (salvar, comentar, seguir).`;
  const count = cardCount ? `Gere exatamente ${cardCount} cards.` : "Entre 5 e 8 cards, o que a ideia pedir.";

  return `${task}
${count}

CONTEXTO DA MARCA:
${context}

FORMATO DOS CARDS
- Cada card é um "tweet" que vira uma imagem 4:5. Ideal de 120 a 320 caracteres por card; nunca passe de 420.
- Em cada card, "texts" tem UM item: o texto inteiro do card. Separe parágrafos com \n\n.
- Use **negrito** com parcimônia (no máximo 1 trecho por card).
- Sem hashtags nos cards, sem emojis em excesso, sem numeração "1/7".
- "cta": sempre null. "visual": sempre "". "styleGuide": "".
- Nunca use travessão (— ou –). Português do Brasil.

LEGENDA
- caption: legenda pronta para o post, sem hashtags.
- hashtags: de 5 a 15, sem o #.`;
}

/** Legenda final: texto + hashtags (sem repetir, sem travessão, até 30 hashtags). */
export function buildCaption(plan: Pick<AgentPlan, "caption" | "hashtags">): string {
  const tags = [
    ...new Set(
      plan.hashtags
        .map((t) => t.trim().replace(/^#+/, "").replace(/\s+/g, ""))
        .filter(Boolean)
    ),
  ]
    .slice(0, 30)
    .map((t) => `#${t}`);
  const body = plan.caption
    .split("\n")
    .map((line) => stripTravessao(line))
    .join("\n")
    .trim();
  const caption = tags.length ? `${body}\n\n${tags.join(" ")}` : body;
  return caption.slice(0, 2200);
}

/**
 * Ordem das imagens anexadas ao card (o prompt cita cada uma pelo número):
 * capa (cards depois da capa) → logo da marca → referências do perfil.
 */
export function referenceOrder(input: { coverAsReference: boolean; hasLogo: boolean; profileReferenceCount: number }) {
  let n = 1;
  const cover = input.coverAsReference ? n++ : null;
  const logo = input.hasLogo ? n++ : null;
  const profile = input.profileReferenceCount > 0 ? { first: n, last: n + input.profileReferenceCount - 1 } : null;
  return { cover, logo, profile };
}

export function buildCardPrompt(input: {
  plan: Pick<AgentPlan, "styleGuide" | "cards">;
  index: number;
  format?: AgentFormat;
  /** A logo do perfil vai anexada para a IA aplicar na arte. */
  hasLogo: boolean;
  /** Os cards depois da capa recebem a capa como referência de estilo. */
  coverAsReference: boolean;
  /** Quantas imagens de referência do perfil vão anexadas. */
  profileReferenceCount: number;
  /** Pedido feito na aprovação ("refazer com ..."). */
  instruction?: string | null;
  /** Direção de arte mandada pelo agente para o pedido inteiro. */
  visualDirection?: string | null;
  /** Deixar a faixa de baixo vazia: o rodapé da marca entra depois, em código. */
  reserveFooter?: boolean;
  /** Deixar o topo sem texto: a logo entra depois, em código. */
  reserveTop?: boolean;
}): string {
  const { plan, index } = input;
  const card = plan.cards[index];
  const total = plan.cards.length;
  const single = input.format === "single" || total === 1;
  const role = index === 0 ? "a CAPA" : index === total - 1 ? "o ÚLTIMO card" : `o card ${index + 1}`;

  const texts = card.texts.map((t) => stripTravessao(t)).filter((t) => t.trim());
  const lines = texts.map((t) => `"${t}"`);
  if (card.cta?.trim()) lines.push(`"${stripTravessao(card.cta)}" (botão de CTA)`);

  const order = referenceOrder(input);
  const refs: string[] = [];
  if (order.cover) {
    refs.push(
      `Imagem ${order.cover} é a CAPA deste mesmo carrossel. Use exatamente os mesmos elementos visuais dela: paleta, fundo, tipografia (mesma fonte, peso e tamanho do título), caixas de texto, botões e tratamento de foto. Varie só o layout (onde ficam texto e imagem), para os cards não ficarem iguais à capa. Os cards precisam parecer da mesma peça. Não copie os textos da capa${
        input.reserveFooter ? " nem o rodapé dela (barra de progresso, @, ícones): a faixa de baixo fica vazia" : ""
      }${input.reserveTop ? ". Não copie a logo da capa: o topo fica livre" : ""
      }.`
    );
  }
  if (order.logo) {
    refs.push(
      `Imagem ${order.logo} é a LOGO da marca: aplique exatamente esta logo na arte, sem redesenhar, sem mudar formas, cores, letras ou proporção, pequena e discreta no canto superior esquerdo. Se a logo tiver fundo branco ou retângulo atrás, NÃO reproduza esse fundo: só o símbolo/letreiro, integrado à arte. Não invente outra logo.`
    );
  }
  if (order.profile) {
    const { first, last } = order.profile;
    const range = first === last ? `Imagem ${first} é referência` : `Imagens ${first} a ${last} são referências`;
    refs.push(
      `${range} o MODELO VISUAL da marca: siga a mesma linguagem (caixas de texto, botões, cores, tipografia, tratamento e enquadramento de foto)${
        order.cover ? ", junto com a capa" : ""
      }. Troque a foto e os textos pelos deste card; não copie os textos nem a foto delas.${
        input.reserveFooter ? " Não reproduza o rodapé delas (barra de progresso, @, ícones de redes): ele é aplicado depois." : ""
      }${input.reserveTop ? " Não reproduza a logo delas: ela é aplicada depois." : ""
      }`
    );
  }

  const parts = [
    single
      ? "Arte de post único de Instagram (feed), formato vertical 4:5. A peça precisa funcionar sozinha."
      : `Arte de carrossel de Instagram, formato vertical 4:5. Esta é ${role} de um carrossel de ${total} cards.`,
    single
      ? `GUIA DE ESTILO:\n${plan.styleGuide.trim()}`
      : `GUIA DE ESTILO (vale para todos os cards):\n${plan.styleGuide.trim()}`,
    ...(input.visualDirection?.trim()
      ? [`DIREÇÃO DE ARTE DO PEDIDO (prioridade sobre o guia de estilo):\n${input.visualDirection.trim()}`]
      : []),
    `${single ? "A ARTE" : "ESTE CARD"}:\n${card.visual.trim()}`,
    CLEAN_COMPOSITION_RULE,
    ...(input.reserveTop ? [TOP_RESERVED_RULE] : []),
    ...(input.reserveFooter ? [FOOTER_RESERVED_RULE] : []),
    `${EXACT_TEXT_RULE}\n${lines.join("\n")}`,
    "Escreva os textos exatamente como estão, em português do Brasil, com acentuação correta, sem inventar, traduzir ou repetir palavras. Textos grandes, nítidos e legíveis no celular, com bom contraste.",
  ];

  if (card.cta?.trim()) {
    parts.push(
      `O CTA é um BOTÃO com fundo de cor sólida, SEMPRE centralizado na parte inferior da imagem${
        input.reserveFooter ? ", logo acima da faixa reservada do rodapé" : ""
      }, com o texto do CTA dentro dele.`
    );
  }

  parts.push(
    input.hasLogo
      ? "Além da logo anexada, não escreva marca d'água, @ ou nome de perfil."
      : "Não desenhe logo, marca d'água, @ ou nome de perfil."
  );
  parts.push(
    single
      ? "Não escreva numeração nem setas de 'arraste': é um post único."
      : "Não escreva numeração de página, barra de progresso nem setas de 'arraste'."
  );
  if (refs.length) parts.push(refs.join("\n"));

  if (input.instruction?.trim()) {
    parts.push(`AJUSTE PEDIDO PARA ESTE CARD (prioridade): ${input.instruction.trim()}`);
  }

  return parts.join("\n\n");
}

/** Textos esperados num card (para a revisão automática). */
export function expectedTexts(plan: Pick<AgentPlan, "cards">, index: number): string[] {
  const card = plan.cards[index];
  const out = card.texts.map((t) => stripTravessao(t)).filter((t) => t.trim());
  if (card.cta?.trim()) out.push(stripTravessao(card.cta));
  return out;
}
