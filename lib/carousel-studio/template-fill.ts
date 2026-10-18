/**
 * Geração com páginas-modelo de um estilo.
 *
 *   modelos do estilo ─┐
 *   briefing (artes) ──┼─▶ diretor (IA): modelo + textos + prompts por card ─▶ clona o modelo e troca só os campos
 *   ficha do cliente ──┘
 *
 * Diferente de `layouts.ts`, aqui a geometria vem pronta do estilo: o código
 * não inventa layout, só preenche campos, ajusta o tamanho do texto e enfileira
 * as imagens dos campos "image". Tudo que não é campo (formas, enfeites
 * recortados, rótulos fixos) sai idêntico ao modelo.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getAnthropicClient } from "@/lib/ai/client";
import { stripTravessao } from "@/lib/text/strip-dash";
import type { StyleDna } from "@/lib/carousel-styles/dna";
import {
  STUDIO_FORMATS,
  type StudioBrandKit,
  type StudioDocument,
  type StudioFormat,
  type StudioLayer,
  type StudioPage,
  type StudioSlot,
} from "@/types/carousel-studio";
import type { DemandArte } from "@/types/demand";
import { cloneLayer, newId } from "./layers";
import { nearestAspect, type StudioImageJob } from "./layouts";
import { wrapOperatorPrompt } from "./images";
import { estimateTextHeight, fitFontSize } from "./text-fit";

const DIRECTOR_MODEL = process.env.CAROUSEL_STUDIO_MODEL?.trim() || "claude-opus-5-5";
const MAX_STYLE_IMAGES = 8;
const MAX_REFERENCES = 3;

const TEXT_SLOTS: StudioSlot[] = ["kicker", "title", "body", "note", "cta", "number"];

// ─── Catálogo de modelos (o que o diretor enxerga) ───────────────────────────

export type TemplateField = {
  /** Chave única no modelo: title, body, note, note2, image, image2… */
  key: string;
  slot: StudioSlot;
  layerId: string;
  sample: string;
  /** Imagem: o que o modelo mostra ali (para orientar o prompt). */
  description?: string | null;
  aspect?: string;
};

export type TemplateCatalogEntry = {
  /** M1, M2… */
  code: string;
  page: StudioPage;
  fields: TemplateField[];
};

export function buildTemplateCatalog(pages: StudioPage[]): TemplateCatalogEntry[] {
  return pages.map((page, index) => {
    const counts = new Map<string, number>();
    const fields: TemplateField[] = [];
    for (const layer of page.layers) {
      if (!layer.slot || layer.slot === "logo") continue;
      const n = (counts.get(layer.slot) ?? 0) + 1;
      counts.set(layer.slot, n);
      const key = n === 1 ? layer.slot : `${layer.slot}${n}`;
      fields.push({
        key,
        slot: layer.slot,
        layerId: layer.id,
        sample: layer.type === "text" || layer.type === "button" ? layer.text : "",
        description: layer.type === "image" ? layer.prompt ?? null : null,
        aspect: layer.type === "image" ? nearestAspect(layer.width, layer.height) : undefined,
      });
    }
    return { code: `M${index + 1}`, page, fields };
  });
}

function catalogText(catalog: TemplateCatalogEntry[]): string {
  return catalog
    .map((entry) => {
      const role = entry.page.templateRole ?? "inner";
      const lines = entry.fields.map((f) =>
        f.slot === "image"
          ? `  - ${f.key} (imagem ${f.aspect}): no exemplo mostra "${f.description ?? "imagem"}"`
          : `  - ${f.key} (${f.slot}): exemplo ${JSON.stringify(f.sample)} (${f.sample.length} caracteres)`
      );
      return `${entry.code} · ${role} · ${entry.page.name}\n${lines.join("\n") || "  (sem campos)"}`;
    })
    .join("\n\n");
}

// ─── Plano do diretor ────────────────────────────────────────────────────────

export const templatePlanSchema = z.object({
  slides: z.array(
    z.object({
      model: z.string().describe("Código do modelo usado neste card (M1, M2…)"),
      texts: z
        .array(z.object({ key: z.string(), text: z.string() }))
        .describe("Um item por campo de texto do modelo (title, body, note…). Texto vazio esconde o campo."),
      images: z
        .array(z.object({ key: z.string(), prompt: z.string() }))
        .describe("Um item por campo de imagem do modelo: descreva a imagem NOVA para este card (sem texto dentro)."),
    })
  ),
  caption: z.string().describe("Legenda pronta para o Instagram, com CTA e hashtags."),
});

export type TemplatePlan = z.infer<typeof templatePlanSchema>;

export type TemplateDirectorInput = {
  title: string;
  artes: DemandArte[];
  brand: StudioBrandKit;
  brief?: string | null;
  demandReferenceUrls: string[];
  style: { name: string; dna: StyleDna; imageUrls: string[] };
  catalog: TemplateCatalogEntry[];
};

function artesText(artes: DemandArte[]): string {
  return artes
    .map((a, i) => {
      const lines = [`CARD ${i + 1}`, `- headline: ${a.headline || "(vazio)"}`];
      if (a.subheadline) lines.push(`- subheadline: ${a.subheadline}`);
      if (a.cta) lines.push(`- cta: ${a.cta}`);
      if (a.informacoesExtras) lines.push(`- informações extras: ${a.informacoesExtras}`);
      if (a.observacaoVisual) lines.push(`- observação visual: ${a.observacaoVisual}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

function systemPrompt(input: TemplateDirectorInput): string {
  return `Você é diretor de arte sênior de uma agência brasileira. Vai montar um carrossel de Instagram usando as PÁGINAS-MODELO do estilo "${input.style.name}".

O layout já está pronto em cada modelo: você NÃO desenha nada. Para cada card do briefing você:
1. escolhe o modelo (M1, M2…) que melhor serve aquele conteúdo;
2. escreve o texto de cada campo de texto do modelo;
3. descreve a imagem nova de cada campo de imagem.

ESCOLHA DOS MODELOS
- Card 1 usa um modelo de capa (cover). O último card, se for chamada final, usa um modelo cta; se não houver modelo cta, use um miolo.
- Nos cards do meio, alterne entre os modelos de miolo (inner) para que cada card fique diferente do anterior. Só repita um modelo quando não houver outro.

TEXTOS
- A copy já foi aprovada: use a headline como title e a subheadline como body, sem mudar o sentido. Mantenha a copy inteira sempre que couber; a fonte encolhe sozinha até ~40%. Só enxugue quando o texto passar de ~2x o tamanho do exemplo do campo.
- Quebra de linha é o caractere \\n (como nos exemplos). Nunca use "/" para quebrar linha.
- Se o modelo não tem campo para uma parte da copy (ex.: capa sem body), deixe essa parte de fora em vez de espremer em outro campo.
- Se o exemplo do campo tem um trecho entre *asteriscos* (destaque em outra fonte/cor), destaque 1 a 4 palavras-chave do seu texto do mesmo jeito.
- Campos note são anotações curtas à mão (2 a 5 palavras, caixa alta se o exemplo for), apontando para a imagem.
- Campos number: numeração do card no formato do exemplo (ex.: 01, 02).
- Campo cta só no card de chamada; nos outros deixe vazio. Um "arraste para o lado" repetido no briefing não é cta.
- Se um campo do briefing é instrução para o designer (ex.: "OBS: …"), siga a instrução e não coloque o texto na arte.
- Texto vazio esconde o campo. Nunca use travessão (— ou –).

IMAGENS
- Cada prompt descreve a imagem NOVA deste card, no mesmo tipo e tratamento da imagem do modelo (se o modelo mostra um print de tela flutuando, faça um print/mockup do assunto deste card; se mostra foto, faça foto), adaptada ao assunto do cliente.
- Nunca peça texto legível, letras, números ou logos dentro da imagem.
- Para nichos sensíveis (jurídico, saúde), imagens sóbrias, reais e respeitosas, com pessoas brasileiras.

MODELOS DISPONÍVEIS
${catalogText(input.catalog)}`;
}

function userContent(input: TemplateDirectorInput, withImages: boolean): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  const isHttps = (u: string) => /^https:\/\//.test(u);
  if (withImages) {
    const styleUrls = input.style.imageUrls.filter(isHttps).slice(0, MAX_STYLE_IMAGES);
    if (styleUrls.length) {
      blocks.push({ type: "text", text: `Artes de exemplo do estilo "${input.style.name}" (os modelos nasceram delas; o número no nome do modelo é o card de origem):` });
      styleUrls.forEach((url, i) => {
        blocks.push({ type: "text", text: `Card ${i + 1}:` });
        blocks.push({ type: "image", source: { type: "url", url } });
      });
    }
    const refs = Array.from(new Set([...input.demandReferenceUrls, ...input.brand.referenceUrls]))
      .filter(isHttps)
      .slice(0, MAX_REFERENCES);
    if (refs.length) {
      blocks.push({ type: "text", text: "Referências do cliente e desta demanda (assunto e clima, não layout):" });
      refs.forEach((url) => blocks.push({ type: "image", source: { type: "url", url } }));
    }
  }
  const b = input.brand;
  blocks.push({
    type: "text",
    text: `CLIENTE: ${b.clientName || "(sem nome)"}${b.handle ? ` (${b.handle})` : ""}
CONTEXTO DO NEGÓCIO:
${b.businessContext || "(sem contexto)"}

DEMANDA: ${input.title || "Carrossel"}
${input.brief?.trim() ? `\nINSTRUÇÃO DO OPERADOR PARA ESTA VERSÃO (prioridade alta):\n${input.brief.trim()}\n` : ""}
BRIEFING (${input.artes.length} cards):
${artesText(input.artes)}`,
  });
  return blocks;
}

async function callTemplateDirector(input: TemplateDirectorInput, withImages: boolean): Promise<TemplatePlan> {
  const response = await getAnthropicClient().messages.parse(
    {
      model: DIRECTOR_MODEL,
      max_tokens: 12000,
      system: systemPrompt(input),
      messages: [{ role: "user", content: userContent(input, withImages) }],
      output_config: { effort: "medium", format: zodOutputFormat(templatePlanSchema) },
    },
    { timeout: 150_000 }
  );
  if (response.stop_reason === "refusal") throw new Error("O diretor de arte recusou o briefing");
  if (!response.parsed_output) throw new Error("O diretor de arte não devolveu um plano válido");
  return response.parsed_output;
}

export async function directFromTemplates(
  input: TemplateDirectorInput
): Promise<{ plan: TemplatePlan; usedAi: boolean; error?: string }> {
  if (input.artes.length === 0) {
    return { plan: fallbackTemplatePlan(input), usedAi: false, error: "Demanda sem artes no briefing" };
  }
  try {
    return { plan: await callTemplateDirector(input, true), usedAi: true };
  } catch (error) {
    // Uma URL de referência inacessível derruba a requisição (400): tenta sem imagens.
    if (error instanceof Anthropic.BadRequestError) {
      try {
        return { plan: await callTemplateDirector(input, false), usedAi: true };
      } catch (retryError) {
        error = retryError;
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[carousel-studio/template-fill]", message);
    return { plan: fallbackTemplatePlan(input), usedAi: false, error: message };
  }
}

// ─── Plano determinístico (sem IA) ───────────────────────────────────────────

/** Modelo de cada card: capa no 1º, CTA no último, miolos alternando no meio. */
export function assignModels(catalog: TemplateCatalogEntry[], total: number): string[] {
  const byRole = (role: string) => catalog.filter((c) => (c.page.templateRole ?? "inner") === role);
  const covers = byRole("cover");
  const inners = byRole("inner").length ? byRole("inner") : catalog;
  const ctas = byRole("cta");
  return Array.from({ length: total }, (_, i) => {
    if (i === 0) return (covers[0] ?? catalog[0]).code;
    if (i === total - 1 && total > 1 && ctas.length) return ctas[0].code;
    return inners[(i - 1) % inners.length].code;
  });
}

const INSTRUCTION_PATTERN = /^\s*(obs|observa[cç][aã]o|nota)\s*[:\-]/i;
const SWIPE_PATTERN = /arraste|deslize|passe para o lado|swipe/i;

export function fallbackTemplatePlan(input: Pick<TemplateDirectorInput, "artes" | "catalog" | "title">): TemplatePlan {
  const artes = input.artes.length
    ? input.artes
    : [{ headline: input.title || "Carrossel", subheadline: "", cta: "", informacoesExtras: "", linkReferencias: "", imagensReferencias: [] }];
  const models = assignModels(input.catalog, artes.length);
  return {
    slides: artes.map((arte, i) => {
      const entry = input.catalog.find((c) => c.code === models[i])!;
      const isLast = i === artes.length - 1 && artes.length > 1;
      const body = INSTRUCTION_PATTERN.test(arte.subheadline ?? "") ? "" : arte.subheadline ?? "";
      const cta = isLast && arte.cta && !SWIPE_PATTERN.test(arte.cta) ? arte.cta : "";
      const texts = entry.fields
        .filter((f) => f.slot !== "image")
        .map((f) => {
          const text =
            f.slot === "title" ? arte.headline ?? "" :
            f.slot === "body" ? body :
            f.slot === "cta" ? cta :
            f.slot === "number" ? String(i + 1).padStart(2, "0") :
            "";
          return { key: f.key, text: f.key === f.slot ? text : "" };
        });
      const images = entry.fields
        .filter((f) => f.slot === "image")
        .map((f) => ({
          key: f.key,
          prompt: `${f.description ?? "Imagem"} sobre o tema: "${arte.headline}". ${arte.observacaoVisual ?? ""}`.trim(),
        }));
      return { model: entry.code, texts, images };
    }),
    caption: "",
  };
}

// ─── Plano → documento ───────────────────────────────────────────────────────

function fitText(layer: StudioLayer & { type: "text" }, text: string, maxHeight: number) {
  layer.text = text;
  const height = estimateTextHeight({ ...layer, fontSize: layer.fontSize, width: layer.width });
  if (height <= maxHeight) return;
  layer.fontSize = fitFontSize({
    text,
    width: layer.width,
    maxHeight,
    fontFamily: layer.fontFamily,
    lineHeight: layer.lineHeight,
    min: Math.max(10, Math.round(layer.fontSize * 0.6)),
    max: layer.fontSize,
    uppercase: layer.uppercase,
  });
}

export function buildFromTemplates(params: {
  plan: TemplatePlan;
  catalog: TemplateCatalogEntry[];
  brand: StudioBrandKit;
  format: StudioFormat;
  templateHeight: number;
  imageStyle: string;
}): { document: StudioDocument; jobs: StudioImageJob[] } {
  const size = STUDIO_FORMATS[params.format];
  const sy = size.height / params.templateHeight;
  const jobs: StudioImageJob[] = [];
  const total = params.plan.slides.length;
  const models = assignModels(params.catalog, total);

  const pages: StudioPage[] = params.plan.slides.map((slide, index) => {
    const entry = params.catalog.find((c) => c.code === slide.model.trim().toUpperCase()) ??
      params.catalog.find((c) => c.code === models[index])!;
    // " / " é como o modelo de linguagem às vezes "desenha" quebra de linha.
    const texts = new Map(slide.texts.map((t) => [t.key, stripTravessao(t.text ?? "").replace(/ \/ /g, "\n").trim()]));
    const prompts = new Map(slide.images.map((t) => [t.key, t.prompt.trim()]));
    const fieldByLayer = new Map(entry.fields.map((f) => [f.layerId, f]));

    const page: StudioPage = {
      ...structuredClone(entry.page),
      id: newId(),
      name: `Página ${index + 1}`,
      templateRole: null,
      layers: [],
    };

    for (const original of entry.page.layers) {
      const layer = cloneLayer(original);
      layer.slot = null;
      if (sy !== 1) {
        layer.y = Math.round(original.y * sy);
        if (layer.type !== "text") layer.height = Math.round(original.height * sy);
      }
      const field = fieldByLayer.get(original.id);

      if (original.slot === "logo" && layer.type === "image") {
        if (params.brand.logoUrl) {
          layer.src = params.brand.logoUrl;
          layer.fit = "contain";
        } else {
          layer.hidden = true;
        }
      } else if (field && TEXT_SLOTS.includes(field.slot)) {
        const text = texts.get(field.key) ?? (field.slot === "number" ? String(index + 1).padStart(2, "0") : "");
        if (!text) {
          layer.hidden = true;
        } else if (layer.type === "text") {
          // O modelo foi desenhado para o texto de exemplo: a caixa pode
          // crescer um pouco, além disso a fonte encolhe.
          const sampleHeight = estimateTextHeight({ ...layer, text: original.type === "text" ? original.text : text, width: layer.width });
          fitText(layer, text, Math.max(sampleHeight, layer.height) * 1.25);
        } else if (layer.type === "button") {
          layer.text = text;
        }
      } else if (field?.slot === "image" && layer.type === "image") {
        const prompt = prompts.get(field.key) || field.description || "";
        const kind: StudioImageJob["kind"] = layer.role === "element" ? "element" : "background";
        // A prévia do modelo vira referência da imagem nova (mesmo tratamento).
        const reference = original.type === "image" ? original.src : null;
        layer.prompt = prompt;
        layer.src = null;
        layer.status = "generating";
        layer.error = null;
        if (prompt) {
          jobs.push({
            pageId: page.id,
            layerId: layer.id,
            kind,
            prompt: wrapOperatorPrompt(kind, prompt, params.imageStyle),
            aspectRatio: nearestAspect(layer.width, layer.height),
            referenceUrls: reference && kind === "background" ? [reference] : undefined,
          });
        } else {
          layer.status = null;
          layer.hidden = true;
        }
      }
      page.layers.push(layer);
    }
    return page;
  });

  return {
    document: { version: 1, format: params.format, width: size.width, height: size.height, pages },
    jobs,
  };
}
