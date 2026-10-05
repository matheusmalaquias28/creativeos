/**
 * Diretor de arte do Carrossel Studio.
 *
 * Recebe o briefing da demanda (uma arte = uma página), a ficha do cliente e as
 * referências visuais (vê as imagens) e devolve um `DesignPlan` estruturado:
 * layout de cada página, textos com destaques, prompts de fundo/elemento e as
 * cores-papel da paleta. A geometria fica com `layouts.ts`.
 *
 * Se a IA falhar, `fallbackPlan` monta um plano determinístico com a mesma
 * copy — a demanda nunca fica sem carrossel por causa do diretor.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/ai/client";
import { stripTravessao } from "@/lib/text/strip-dash";
import type { StudioBrandKit, StudioFormat } from "@/types/carousel-studio";
import type { DemandArte } from "@/types/demand";
import { deriveRoles } from "./color";
import { STUDIO_FONTS, studioFontByFamily } from "./fonts";
import { designPlanSchema, type DesignPlan, type SlidePlan } from "./plan";

const DIRECTOR_MODEL = process.env.CAROUSEL_STUDIO_MODEL?.trim() || "claude-opus-5-5";
const MAX_VISION_REFERENCES = 6;

export type DirectorInput = {
  title: string;
  artes: DemandArte[];
  brand: StudioBrandKit;
  format: StudioFormat;
  /** Instrução livre do operador para esta geração. */
  brief?: string | null;
  /** Referências desta demanda (WAR + subidas no studio). */
  demandReferenceUrls: string[];
};

function artesText(artes: DemandArte[]): string {
  return artes
    .map((a, i) => {
      const lines = [`PÁGINA ${i + 1}`, `- headline: ${a.headline || "(vazio)"}`];
      if (a.subheadline) lines.push(`- subheadline: ${a.subheadline}`);
      if (a.cta) lines.push(`- cta: ${a.cta}`);
      if (a.informacoesExtras) lines.push(`- informações extras: ${a.informacoesExtras}`);
      if (a.observacaoVisual) lines.push(`- observação visual: ${a.observacaoVisual}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

function systemPrompt(): string {
  const fonts = STUDIO_FONTS.map((f) => `${f.id} (${f.vibe})`).join("; ");
  return `Você é diretor de arte sênior de uma agência brasileira e monta carrosséis de Instagram de alto padrão, consistentes com a identidade de cada cliente.

Você NÃO desenha a peça: você devolve um plano estruturado. Textos, botões e logo serão montados em código sobre as imagens que você descrever. Por isso:
- Os prompts de imagem (backgroundPrompt, elementPrompt) descrevem SÓ a cena/objeto, sem nenhum texto, letra, número ou logo dentro da imagem.
- backgroundPrompt é foto/ilustração de fundo; elementPrompt é UM objeto isolado (ícone 3D, produto, ilustração, pessoa) que será recortado e posicionado na página.

COPY
- Cada PÁGINA do briefing vira exatamente um slide, na mesma ordem.
- Use a headline como title e a subheadline como body, SEM reescrever o sentido (a copy já foi aprovada). Pode ajustar quebra de linha e envolver 1 a 3 palavras-chave do título em *asteriscos* para destacá-las na cor de acento.
- Se um campo contém uma instrução para o designer (ex.: "OBS: não precisa adicionar texto aqui"), siga a instrução e não coloque esse texto na arte.
- Um cta que se repete em todas as páginas tipo "Arraste para o lado" é indicação de swipe: use swipeHint=true e deixe cta vazio. Só a página final de chamada recebe cta (botão) — use o cta do briefing dela.
- Nunca use travessão (— ou –).

DESIGN
- Página 1 é o gancho: impacto máximo (normalmente hero com foto forte ou statement tipográfico gigante).
- Varie os layouts ao longo do carrossel para manter o ritmo, mas mantenha coesão (mesmas fontes, mesma paleta, mesma direção de imagem).
- A última página normalmente é layout cta.
- Use SÓ cores da paleta do cliente nas cores-papel. dark e light precisam contrastar muito entre si; accent precisa aparecer bem sobre dark.
- Fontes disponíveis: ${fonts}. Escolha um par coerente com o DNA visual (títulos com personalidade, texto legível).
- imageStyle descreve a direção visual comum a todas as imagens (luz, lente, estilo, textura, paleta), derivada das referências do cliente.
- Para nichos sensíveis (jurídico, saúde), prefira imagens sóbrias, reais e respeitosas, com pessoas brasileiras.`;
}

function userContent(input: DirectorInput, imageUrls: string[]): Anthropic.ContentBlockParam[] {
  const b = input.brand;
  const blocks: Anthropic.ContentBlockParam[] = [];
  imageUrls.forEach((url) => {
    blocks.push({ type: "image", source: { type: "url", url } });
  });
  const headingHint = studioFontByFamily(b.fontHeading)?.id;
  blocks.push({
    type: "text",
    text: `${imageUrls.length ? `As ${imageUrls.length} imagens acima são referências visuais do cliente e desta demanda — use-as para definir imageStyle, composição e clima.\n\n` : ""}CLIENTE: ${b.clientName || "(sem nome)"}${b.handle ? ` (${b.handle})` : ""}
PALETA DA FICHA: ${b.palette.length ? b.palette.join(", ") : "(sem paleta — proponha uma sóbria e elegante)"}
${headingHint ? `FONTE DE TÍTULO DO CLIENTE: ${headingHint} (use-a)\n` : ""}DNA VISUAL:
${b.styleNotes || "(não extraído — deduza das referências)"}

CONTEXTO DO NEGÓCIO:
${b.businessContext || "(sem contexto)"}

FORMATO: ${input.format}
DEMANDA: ${input.title || "Carrossel"}
${input.brief?.trim() ? `\nINSTRUÇÃO DO OPERADOR PARA ESTA VERSÃO (prioridade alta):\n${input.brief.trim()}\n` : ""}
BRIEFING (${input.artes.length} páginas):
${artesText(input.artes)}`,
  });
  return blocks;
}

function cleanPlan(plan: DesignPlan, input: DirectorInput): DesignPlan {
  const slides = plan.slides.slice(0, Math.max(1, input.artes.length || plan.slides.length));
  return {
    ...plan,
    slides: slides.map((s) => ({
      ...s,
      kicker: stripTravessao(s.kicker ?? ""),
      title: stripTravessao(s.title ?? ""),
      body: stripTravessao(s.body ?? ""),
      cta: stripTravessao(s.cta ?? ""),
    })),
    caption: stripTravessao(plan.caption ?? ""),
  };
}

async function callDirector(input: DirectorInput, imageUrls: string[]): Promise<DesignPlan> {
  const client = getAnthropicClient();
  const response = await client.messages.parse(
    {
      model: DIRECTOR_MODEL,
      max_tokens: 16000,
      system: systemPrompt(),
      messages: [{ role: "user", content: userContent(input, imageUrls) }],
      output_config: { effort: "medium", format: zodOutputFormat(designPlanSchema) },
    },
    { timeout: 150_000 }
  );
  if (response.stop_reason === "refusal") throw new Error("O diretor de arte recusou o briefing");
  if (!response.parsed_output) throw new Error("O diretor de arte não devolveu um plano válido");
  return response.parsed_output;
}

export async function directCarousel(input: DirectorInput): Promise<{ plan: DesignPlan; usedAi: boolean; error?: string }> {
  if (input.artes.length === 0) {
    return { plan: fallbackPlan(input), usedAi: false, error: "Demanda sem artes no briefing" };
  }
  const imageUrls = Array.from(new Set([...input.demandReferenceUrls, ...input.brand.referenceUrls]))
    .filter((u) => /^https:\/\//.test(u))
    .slice(0, MAX_VISION_REFERENCES);

  try {
    return { plan: cleanPlan(await callDirector(input, imageUrls), input), usedAi: true };
  } catch (error) {
    // Uma URL de referência inacessível derruba a requisição inteira (400):
    // tenta de novo só com texto antes de cair no plano determinístico.
    if (imageUrls.length > 0 && error instanceof Anthropic.BadRequestError) {
      try {
        return { plan: cleanPlan(await callDirector(input, []), input), usedAi: true };
      } catch (retryError) {
        error = retryError;
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[carousel-studio/director]", message);
    return { plan: fallbackPlan(input), usedAi: false, error: message };
  }
}

// ─── Plano determinístico (sem IA) ───────────────────────────────────────────

const INSTRUCTION_PATTERN = /^\s*(obs|observa[cç][aã]o|nota)\s*[:\-]/i;
const SWIPE_PATTERN = /arraste|deslize|passe para o lado|swipe/i;

export function fallbackPlan(input: DirectorInput): DesignPlan {
  const roles = deriveRoles(input.brand.palette);
  const total = Math.max(1, input.artes.length);
  const artes = input.artes.length ? input.artes : [{ headline: input.title || "Carrossel", subheadline: "", cta: "", informacoesExtras: "", linkReferencias: "", imagensReferencias: [] }];

  const slides: SlidePlan[] = artes.map((arte, i) => {
    const isFirst = i === 0;
    const isLast = i === total - 1 && total > 1;
    const body = INSTRUCTION_PATTERN.test(arte.subheadline ?? "") ? "" : arte.subheadline ?? "";
    const swipe = !isLast;
    const cta = isLast && arte.cta && !SWIPE_PATTERN.test(arte.cta) ? arte.cta : "";
    const scene = `Imagem editorial que representa visualmente: "${arte.headline}". ${arte.observacaoVisual ?? ""}`.trim();
    const layout: SlidePlan["layout"] = isFirst ? "hero" : isLast ? "cta" : i % 2 === 1 ? "statement" : "split";
    return {
      layout,
      textPosition: layout === "split" ? "bottom" : layout === "statement" ? "center" : "bottom",
      tone: "dark",
      kicker: "",
      title: stripTravessao(arte.headline ?? ""),
      body: stripTravessao(body),
      cta: stripTravessao(cta),
      swipeHint: swipe,
      backgroundPrompt: layout === "statement" ? "" : scene,
      elementPrompt: "",
      elementSide: "right",
    };
  });

  const headingId = studioFontByFamily(input.brand.fontHeading)?.id ?? "montserrat";
  return {
    fontHeading: headingId,
    fontBody: studioFontByFamily(input.brand.fontBody)?.id ?? "inter",
    colors: roles,
    imageStyle: "Fotografia realista, luz natural suave, profundidade de campo rasa, tons alinhados à paleta da marca.",
    slides,
    caption: "",
  };
}
