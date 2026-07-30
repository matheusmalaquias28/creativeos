import { getAnthropicClient } from "@/lib/ai/client";
import { parseMvpPages, type MvpPage } from "@/types/mvp";
import { splitContentIntoChunks } from "./chunk-content";

const ORGANIZER_MODEL = process.env.MVP_ORGANIZER_MODEL ?? "claude-haiku-4-5-20251001";
// Cada chamada organiza um trecho de ~12k chars — 16k tokens de saída sobram.
const MAX_TOKENS = 16_000;

const SYSTEM_PROMPT = `Você é um designer editorial especialista em infoprodutos (e-books, guias, workbooks).
Sua tarefa: receber um trecho do conteúdo de um MVP de infoproduto e organizá-lo em páginas A4 (vertical), de forma bonita, consistente e legível.

REGRA ABSOLUTA: você NÃO é autor, é diagramador. É PROIBIDO criar qualquer conteúdo novo — nenhuma frase, título, exemplo, transição, introdução, conclusão ou CTA que não exista no texto recebido. Todo texto de todo bloco deve ser cópia LITERAL de um trecho do conteúdo original.

Regras:
- NÃO resuma, NÃO reescreva, NÃO parafraseie, NÃO complete ideias. Seu único trabalho é distribuir o texto existente em páginas e blocos.
- Preserve todo o conteúdo do trecho: nada pode ser omitido e nada pode ser acrescentado.
- Títulos de página: use os títulos/subtítulos que já existem no texto. Se um trecho não tiver título próprio, use as primeiras palavras do próprio trecho — nunca invente um.
- Cada página deve ter uma quantidade confortável de conteúdo para uma folha A4 — nunca lote uma página; prefira criar mais páginas.
- Blocos disponíveis: "title" (título da página), "subtitle", "paragraph", "bullet" (um item por bloco), "quote", "cta". Use "cta" apenas se o texto original já contiver uma chamada para ação.
- Responda SOMENTE com JSON válido, sem markdown, no formato:
{"pages":[{"title":"...","blocks":[{"type":"title","text":"..."},{"type":"paragraph","text":"..."}]}]}`;

function parseJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return JSON.parse(fenced[1].trim());
  const bare = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(bare ? bare[0] : raw);
}

/**
 * Resposta truncada (max_tokens) corta o JSON no meio de uma página. Varre o
 * array "pages" com um scanner de chaves (respeitando strings/escapes) e
 * devolve só os objetos de página que fecharam por completo.
 */
function salvageTruncatedPages(raw: string): unknown[] {
  const start = raw.indexOf('"pages"');
  if (start === -1) return [];
  const arrayStart = raw.indexOf("[", start);
  if (arrayStart === -1) return [];

  const pages: unknown[] = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = arrayStart + 1; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        try {
          pages.push(JSON.parse(raw.slice(objStart, i + 1)));
        } catch {
          // objeto corrompido — ignora e segue
        }
        objStart = -1;
      }
    } else if (ch === "]" && depth === 0) break;
  }

  return pages;
}

async function organizeChunk(
  chunk: string,
  chunkIndex: number,
  totalChunks: number
): Promise<MvpPage[]> {
  const anthropic = getAnthropicClient();
  const contextNote =
    totalChunks > 1
      ? `Este é o trecho ${chunkIndex + 1} de ${totalChunks} de um documento maior. ${
          chunkIndex === 0
            ? "A primeira página deve ser a capa: só o título do próprio documento (e subtítulo, se o texto tiver um) — não crie título novo."
            : "NÃO crie capa — continue o miolo do documento."
        }`
      : "A primeira página deve ser a capa: só o título do próprio documento (e subtítulo, se o texto tiver um) — não crie título novo.";

  // max_tokens alto obriga streaming no SDK ("Streaming is required...") —
  // acumula e pega a mensagem final.
  const response = await anthropic.messages
    .stream({
      model: ORGANIZER_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${contextNote}\n\nOrganize este conteúdo em páginas A4:\n\n${chunk}`,
        },
      ],
    })
    .finalMessage();

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Resposta vazia do organizador de páginas");
  }

  let rawPages: unknown;
  try {
    const parsed = parseJson(textBlock.text) as { pages?: unknown };
    rawPages = parsed?.pages ?? parsed;
  } catch (err) {
    const salvaged = salvageTruncatedPages(textBlock.text);
    if (salvaged.length === 0) throw err;
    console.warn(
      `[mvp/organize-pages] JSON truncado no trecho ${chunkIndex + 1} (stop_reason=${response.stop_reason}) — aproveitando ${salvaged.length} página(s) completas`
    );
    rawPages = salvaged;
  }

  return parseMvpPages(rawPages);
}

export type OrganizeProgress = {
  /** páginas acumuladas até aqui (reindexadas) */
  pages: MvpPage[];
  /** trechos concluídos (checkpoint para retomada) */
  chunksDone: number;
  totalChunks: number;
};

/**
 * Divide o conteúdo do docx em trechos e organiza cada um em páginas via Claude.
 * A cada trecho concluído chama `onProgress` (persistência do checkpoint) — se a
 * chamada seguinte falhar, o retry retoma de `startChunk` com `initialPages` em
 * vez de recomeçar do zero. O usuário revisa tudo no preview A4 antes de gerar.
 */
export async function organizeMvpPages(
  rawContent: string,
  opts: {
    startChunk?: number;
    initialPages?: MvpPage[];
    onProgress?: (progress: OrganizeProgress) => Promise<void>;
  } = {}
): Promise<MvpPage[]> {
  const chunks = splitContentIntoChunks(rawContent);
  const startChunk = Math.min(opts.startChunk ?? 0, chunks.length);
  let pages: MvpPage[] = startChunk > 0 ? [...(opts.initialPages ?? [])] : [];

  for (let i = startChunk; i < chunks.length; i++) {
    const chunkPages = await organizeChunk(chunks[i], i, chunks.length);
    pages = [...pages, ...chunkPages].map((page, index) => ({
      ...page,
      index,
      referenceUrls: page.referenceUrls ?? [],
    }));
    await opts.onProgress?.({ pages, chunksDone: i + 1, totalChunks: chunks.length });
  }

  if (pages.length === 0) {
    throw new Error("O organizador não retornou nenhuma página");
  }
  return pages;
}
