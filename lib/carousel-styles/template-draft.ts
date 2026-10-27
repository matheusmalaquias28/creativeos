/**
 * Rascunho das páginas-modelo de um estilo de carrossel.
 *
 * A IA (OpenAI) olha cada arte de exemplo e devolve as camadas que a compõem (caixa
 * em milésimos do card, fonte, cor, campo). O código transforma isso em uma
 * página do Studio:
 *   - texto, forma e botão viram camadas de código, editáveis;
 *   - enfeites (setas à mão, ícones, selos, mockups) são RECORTADOS da própria
 *     arte — ficam idênticos ao estilo, sem custo de geração;
 *   - imagens de conteúdo viram campo "image": o recorte fica como prévia e
 *     cada carrossel gera a sua.
 *
 * É um rascunho: o operador ajusta no editor uma vez e o estilo fica pronto.
 */

import pLimit from "p-limit";
import sharp from "sharp";
import { z } from "zod";
import { inputImage, inputText, openaiStructured } from "@/lib/ai/openai-text";
import { removeFlatBackground } from "@/lib/carousel-studio/cutout";
import { STUDIO_FONT_IDS, STUDIO_FONTS, studioFontById } from "@/lib/carousel-studio/fonts";
import { uploadStudioImage } from "@/lib/carousel-studio/images";
import {
  makeButtonLayer,
  makeImageLayer,
  makePage,
  makeShapeLayer,
  makeTextLayer,
} from "@/lib/carousel-studio/layers";
import { styleDnaText, type StyleDna } from "./dna";
import type { StudioLayer, StudioPage, StudioTemplateRole } from "@/types/carousel-studio";

const DRAFT_CONCURRENCY = 3;

const hex = z.string().describe("Cor hex #RRGGBB");
const permille = z.number().describe("Milésimos (0 a 1000)");

const draftLayerSchema = z.object({
  kind: z
    .enum(["text", "shape", "button", "photo", "asset"])
    .describe(
      "text = texto tipográfico; shape = retângulo/círculo/pílula de cor sólida; button = pílula/botão com texto; photo = imagem de CONTEÚDO que muda a cada carrossel (foto, print, mockup do assunto); asset = enfeite gráfico que se repete no estilo (seta desenhada à mão, ícone, selo, rabisco, adesivo)"
    ),
  slot: z
    .enum(["none", "kicker", "title", "body", "note", "cta", "number", "image", "logo"])
    .describe(
      "Campo que muda a cada carrossel: title/body/kicker/note/cta/number para textos e botões; image para photo; logo para a logo da marca do exemplo. none = decoração fixa (formas, assets, rótulos fixos como 'SWIPE')."
    ),
  x: permille.describe("Borda esquerda, em milésimos da LARGURA do card"),
  y: permille.describe("Borda de cima, em milésimos da ALTURA do card"),
  w: permille.describe("Largura, em milésimos da LARGURA do card"),
  h: permille.describe("Altura, em milésimos da ALTURA do card"),
  rotation: z.number().describe("Graus, sentido horário (0 se reto)"),
  text: z
    .string()
    .describe("Texto exato visto (text/button). Se parte do texto usa outra fonte ou cor de destaque, envolva essa parte em *asteriscos*. Vazio para os demais."),
  font: z.enum(STUDIO_FONT_IDS).describe("Fonte disponível mais próxima (text/button)"),
  accentFont: z
    .enum(["none", ...STUDIO_FONT_IDS] as [string, ...string[]])
    .describe("Fonte dos trechos *em destaque*, se for diferente da principal; senão none"),
  accentItalic: z.boolean().describe("Trechos em destaque estão em itálico"),
  fontSize: z.number().describe("Altura da letra (corpo da fonte), em milésimos da LARGURA do card"),
  weight: z.number().describe("Peso 300 a 900"),
  italic: z.boolean(),
  uppercase: z.boolean(),
  align: z.enum(["left", "center", "right"]),
  lineHeight: z.number().describe("Entrelinha relativa (ex.: 0.95, 1.2)"),
  letterSpacing: z.number().describe("Espaçamento entre letras em em (ex.: -0.03)"),
  color: hex.describe("Cor do texto (text/button) ou do preenchimento (shape/button usa fill)"),
  accentColor: hex.describe("Cor dos trechos em destaque (igual a color se não houver)"),
  fill: hex.describe("Preenchimento de shape/button (#000000 se não se aplica)"),
  radius: permille.describe("Raio dos cantos em milésimos da largura do card (999 = pílula)"),
  shape: z.enum(["rect", "ellipse"]),
  shadow: z.boolean().describe("Tem sombra suave"),
  description: z
    .string()
    .describe("photo/asset: o que é, para gerar de novo (photo) ou identificar (asset). Em português, sem citar textos."),
  cutout: z.boolean().describe("photo/asset sem fundo próprio (objeto recortado sobre o fundo do card) = true; imagem retangular = false"),
});

export const cardDraftSchema = z.object({
  role: z.enum(["cover", "inner", "cta"]),
  name: z.string().describe("Nome curto do modelo (ex.: 'Capa com foto', 'Miolo print + nota')"),
  background: hex.describe("Cor de fundo predominante do card"),
  layers: z.array(draftLayerSchema).describe("Camadas de TRÁS para a FRENTE. Inclua tudo que aparece, inclusive logo e rótulos."),
});

export type CardDraft = z.infer<typeof cardDraftSchema>;
type DraftLayer = CardDraft["layers"][number];

function systemPrompt(dna: StyleDna | null): string {
  const fonts = STUDIO_FONTS.map((f) => `${f.id} (${f.vibe})`).join("; ");
  return `Você é designer sênior e está desmontando um card de carrossel de Instagram em camadas, para recriá-lo num editor estilo Figma.

Devolva cada elemento visível como uma camada com caixa precisa (em milésimos do card) e estilo. A recriação precisa ficar o mais próxima possível do original.

Regras:
- Caixas justas em volta do elemento. Para texto, a caixa cobre todas as linhas.
- Título com duas fontes (ex.: parte sans + parte serifada itálica) é UMA camada de texto: a parte diferente vai entre *asteriscos*, com accentFont/accentItalic.
- Fundo de cor lisa não é camada (vai em background). Foto de fundo em tela cheia é uma camada photo cobrindo o card (x=0, y=0, w=1000, h=1000).
- Prints de tela, mockups e fotos do ASSUNTO são photo com slot image. Enfeites que se repetiriam em outro carrossel do mesmo estilo (setas à mão, ícones de app, rabiscos, selos) são asset com slot none.
- Anotação manuscrita é text com font caveat e slot note.
- Logo da marca do exemplo: asset com slot logo.
- Rótulos fixos de navegação (ex.: "SWIPE", "ARRASTE") são button ou text com slot none.
- Fontes disponíveis: ${fonts}.
${dna ? `\nContexto do estilo (já analisado):\n${styleDnaText(dna)}` : ""}`;
}

async function draftCard(params: {
  imageUrl: string;
  index: number;
  total: number;
  roleHint: StudioTemplateRole | null;
  dna: StyleDna | null;
}): Promise<CardDraft> {
  return openaiStructured({
    system: systemPrompt(params.dna),
    input: [
      inputImage(params.imageUrl),
      inputText(
        `Card ${params.index + 1} de ${params.total}${params.roleHint ? ` (papel: ${params.roleHint})` : ""}. Desmonte em camadas.`
      ),
    ],
    schemaName: "card_draft",
    schema: cardDraftSchema,
    maxOutputTokens: 24000,
    reasoningEffort: "medium",
    timeoutMs: 150_000,
  });
}

// ─── Rascunho → página do Studio ─────────────────────────────────────────────

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function isHex(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

function color(value: string, fallback: string): string {
  return isHex(value) ? value.trim() : fallback;
}

type Box = { x: number; y: number; width: number; height: number };

function toBox(layer: DraftLayer, W: number, H: number): Box {
  const x = clamp(layer.x, -100, 1000) / 1000;
  const y = clamp(layer.y, -100, 1000) / 1000;
  const w = clamp(layer.w, 5, 1100) / 1000;
  const h = clamp(layer.h, 5, 1100) / 1000;
  return { x: Math.round(x * W), y: Math.round(y * H), width: Math.round(w * W), height: Math.round(h * H) };
}

type PxRect = { left: number; top: number; width: number; height: number };

function pxRect(layer: Pick<DraftLayer, "x" | "y" | "w" | "h">, meta: { width: number; height: number }, pad = 0): PxRect | null {
  const left = Math.max(0, Math.floor((layer.x / 1000) * meta.width) - pad);
  const top = Math.max(0, Math.floor((layer.y / 1000) * meta.height) - pad);
  const right = Math.min(meta.width, Math.ceil(((layer.x + layer.w) / 1000) * meta.width) + pad);
  const bottom = Math.min(meta.height, Math.ceil(((layer.y + layer.h) / 1000) * meta.height) + pad);
  if (right - left < 4 || bottom - top < 4) return null;
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Recorte da arte original (em px do original) com uma folga em volta.
 * `cover` são áreas de outras camadas (textos) que invadem o recorte: são
 * pintadas com a cor de fundo antes, para o recorte de um enfeite não levar
 * pedaço de letra junto.
 */
async function cropFromOriginal(
  original: Buffer,
  meta: { width: number; height: number },
  layer: DraftLayer,
  pad: number,
  cover: { rects: PxRect[]; color: string } | null = null
): Promise<Buffer | null> {
  const rect = pxRect(layer, meta, pad);
  if (!rect) return null;
  let image = sharp(original).extract(rect);
  const patches = (cover?.rects ?? [])
    .map((r) => {
      const left = Math.max(r.left, rect.left);
      const top = Math.max(r.top, rect.top);
      const right = Math.min(r.left + r.width, rect.left + rect.width);
      const bottom = Math.min(r.top + r.height, rect.top + rect.height);
      return right - left > 0 && bottom - top > 0
        ? { left: left - rect.left, top: top - rect.top, width: right - left, height: bottom - top }
        : null;
    })
    .filter((p): p is PxRect => Boolean(p));
  if (patches.length && cover) {
    image = sharp(await image.png().toBuffer()).composite(
      patches.map((p) => ({
        input: { create: { width: p.width, height: p.height, channels: 4 as const, background: cover.color } },
        left: p.left,
        top: p.top,
      }))
    );
  }
  return image.png().toBuffer();
}

export async function draftToPage(params: {
  draft: CardDraft;
  original: Buffer;
  templateId: string;
  width: number;
  height: number;
}): Promise<StudioPage> {
  const { draft, original, templateId, width: W, height: H } = params;
  const meta = await sharp(original).metadata();
  const dims = { width: meta.width ?? W, height: meta.height ?? H };
  const background = color(draft.background, "#ffffff");
  const page = makePage({ name: draft.name || "Modelo", background, templateRole: draft.role });

  for (const layer of draft.layers) {
    const box = toBox(layer, W, H);
    const slot = layer.slot === "none" ? null : layer.slot;
    const base = { ...box, rotation: Math.round(layer.rotation || 0), name: layer.description?.slice(0, 40) || layer.kind };
    let made: StudioLayer | null = null;

    if (layer.kind === "text") {
      const font = studioFontById(layer.font);
      made = makeTextLayer({
        ...base,
        name: slot ? `Campo: ${slot}` : (layer.text.slice(0, 32) || "Texto"),
        text: layer.text || " ",
        fontFamily: font.family,
        fontSize: Math.max(10, Math.round((layer.fontSize / 1000) * W)),
        fontWeight: clamp(Math.round(layer.weight / 100) * 100, 300, font.heavy),
        italic: layer.italic,
        uppercase: layer.uppercase,
        align: layer.align,
        lineHeight: clamp(layer.lineHeight || 1.1, 0.7, 2),
        letterSpacing: Math.round(clamp(layer.letterSpacing || 0, -0.1, 0.4) * ((layer.fontSize / 1000) * W) * 10) / 10,
        color: color(layer.color, "#111111"),
        accentColor: color(layer.accentColor, color(layer.color, "#111111")),
        accentFontFamily: layer.accentFont !== "none" ? studioFontById(layer.accentFont).family : null,
        accentItalic: layer.accentItalic,
        autoHeight: true,
        shadow: false,
        slot,
      });
    } else if (layer.kind === "shape") {
      made = makeShapeLayer({
        ...base,
        name: "Forma",
        shape: layer.shape,
        fill: color(layer.fill, color(layer.color, "#ffffff")),
        radius: layer.radius >= 999 ? 999 : Math.round((layer.radius / 1000) * W),
      });
    } else if (layer.kind === "button") {
      const font = studioFontById(layer.font);
      made = makeButtonLayer({
        ...base,
        name: slot ? "Campo: cta" : (layer.text.slice(0, 32) || "Botão"),
        text: layer.text || " ",
        fontFamily: font.family,
        fontSize: Math.max(10, Math.round((layer.fontSize / 1000) * W)),
        fontWeight: clamp(Math.round(layer.weight / 100) * 100, 300, font.heavy),
        color: color(layer.color, "#111111"),
        fill: color(layer.fill, "#ffffff"),
        radius: layer.radius >= 999 ? 999 : Math.round((layer.radius / 1000) * W),
        uppercase: layer.uppercase,
        icon: /→|->|›/.test(layer.text) ? "ArrowRight" : null,
        slot: slot === "cta" ? "cta" : null,
      });
      if (made.type === "button") made.text = made.text.replace(/\s*(→|->|›)\s*/g, " ").trim() || " ";
    } else {
      // photo / asset: recorte da arte original.
      const fullBleed = layer.w >= 900 && layer.h >= 900;
      const isContent = layer.kind === "photo";
      let src: string | null = null;
      let fit: "cover" | "contain" = isContent && !layer.cutout ? "cover" : "contain";
      // Foto de fundo inteira carrega o texto do exemplo por cima: no modelo
      // fica sem prévia (gerada em cada carrossel).
      if (!(fullBleed && isContent)) {
        // Enfeite recortado sobre fundo liso: textos vizinhos que caem dentro
        // da caixa são apagados antes (viram camadas de texto à parte).
        const cover = layer.cutout
          ? {
              color: background,
              rects: draft.layers
                .filter((other) => other !== layer && (other.kind === "text" || other.kind === "button"))
                .map((other) => pxRect(other, dims, 2))
                .filter((r): r is PxRect => Boolean(r)),
            }
          : null;
        const crop = await cropFromOriginal(original, dims, layer, layer.cutout ? 6 : 0, cover).catch(() => null);
        if (crop) {
          if (layer.cutout) {
            const cut = await removeFlatBackground(crop);
            src = await uploadStudioImage(templateId, cut.buffer, "image/png");
          } else {
            src = await uploadStudioImage(templateId, crop, "image/png");
          }
        }
      } else {
        fit = "cover";
      }
      made = makeImageLayer({
        ...base,
        name: slot === "logo" ? "Campo: logo" : isContent ? "Campo: imagem" : (layer.description?.slice(0, 32) || "Enfeite"),
        src,
        role: fullBleed ? "background" : layer.cutout ? "element" : "photo",
        fit,
        radius: Math.round((layer.radius / 1000) * W),
        shadow: layer.shadow,
        prompt: layer.description || null,
        slot: isContent ? "image" : slot === "logo" ? "logo" : null,
      });
    }
    if (made) page.layers.push(made);
  }
  return page;
}

export async function draftTemplatePages(params: {
  templateId: string;
  images: Array<{ url: string; role: StudioTemplateRole | null }>;
  dna: StyleDna | null;
  width: number;
  height: number;
  onProgress?: (done: number, total: number) => void | Promise<void>;
}): Promise<{ pages: StudioPage[]; failed: number }> {
  const limit = pLimit(DRAFT_CONCURRENCY);
  let done = 0;
  const results = await Promise.all(
    params.images.map((image, index) =>
      limit(async () => {
        try {
          const [draft, original] = await Promise.all([
            draftCard({ imageUrl: image.url, index, total: params.images.length, roleHint: image.role, dna: params.dna }),
            fetch(image.url).then(async (r) => {
              if (!r.ok) throw new Error(`Não foi possível baixar a arte ${index + 1}`);
              return Buffer.from(await r.arrayBuffer());
            }),
          ]);
          if (image.role) draft.role = image.role;
          const page = await draftToPage({
            draft,
            original,
            templateId: params.templateId,
            width: params.width,
            height: params.height,
          });
          page.name = `${index + 1}. ${page.name}`;
          return page;
        } catch (error) {
          console.error("[carousel-styles/template-draft] card falhou", index + 1, error instanceof Error ? error.message : error);
          return null;
        } finally {
          done += 1;
          await params.onProgress?.(done, params.images.length);
        }
      })
    )
  );
  const pages = results.filter((p): p is StudioPage => Boolean(p));
  return { pages, failed: results.length - pages.length };
}
