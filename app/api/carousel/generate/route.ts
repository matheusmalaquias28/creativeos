import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openaiText } from "@/lib/ai/openai-text";
import { stripTravessao } from "@/lib/text/strip-dash";
import type { CarouselSlide } from "@/types/carousel";

const NO_DASH_RULE =
  "IMPORTANTE: nunca use travessão (— ou –). Use vírgula, ponto ou frases curtas.";

type GenerateRequest =
  | { type: "slides"; prompt: string; slideCount?: number }
  | {
      type: "refine";
      slide: Pick<CarouselSlide, "titulo" | "subtitulo">;
      instruction: string;
    }
  | {
      type: "improve";
      slides: Pick<CarouselSlide, "titulo" | "subtitulo">[];
      instruction: string;
    }
  | { type: "caption"; slides: Pick<CarouselSlide, "titulo" | "subtitulo">[] };

/** Modelo leve para as edições rápidas do editor. Override: `OPENAI_CAROUSEL_FAST_MODEL`. */
const FAST_MODEL = process.env.OPENAI_CAROUSEL_FAST_MODEL?.trim() || "gpt-5.4-mini";

const SYSTEM = "Você é redator de carrosséis de Instagram para uma agência brasileira. Escreva em português do Brasil.";

/** Uma pergunta, uma resposta em texto; null se a OpenAI não devolver nada. */
async function ask(prompt: string, maxOutputTokens: number): Promise<string | null> {
  try {
    return await openaiText({
      model: FAST_MODEL,
      system: SYSTEM,
      input: prompt,
      maxOutputTokens,
      reasoningEffort: "low",
    });
  } catch (error) {
    console.error("[carousel/generate]", error instanceof Error ? error.message : error);
    return null;
  }
}

function extractJson<T>(text: string, isArray: boolean): T {
  const trimmed = text.trim();
  const pattern = isArray ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const match = trimmed.match(pattern);
  return JSON.parse(match ? match[0] : trimmed) as T;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body: GenerateRequest = await req.json();

  if (body.type === "slides") {
    const count = Math.min(Math.max(body.slideCount ?? 5, 1), 20);
    const text = await ask(
      `Crie ${count} slides para um carrossel do Instagram sobre: "${body.prompt}".

Responda APENAS com um JSON array, sem markdown:
[
  { "titulo": "TÍTULO IMPACTANTE", "subtitulo": "Frase de apoio direta (1-2 linhas)" }
]

Regras:
- Títulos curtos, diretos e impactantes (máx 8 palavras)
- Subtítulos complementam o título (máx 20 palavras)
- ${NO_DASH_RULE}
- Nenhum texto além do JSON`,
      6000
    );
    if (!text) {
      return NextResponse.json({ error: "Sem resposta" }, { status: 500 });
    }

    try {
      const slides = extractJson<{ titulo: string; subtitulo: string }[]>(
        text,
        true
      ).map((s) => ({
        titulo: stripTravessao(s.titulo),
        subtitulo: stripTravessao(s.subtitulo),
      }));
      return NextResponse.json({ slides });
    } catch {
      return NextResponse.json({ error: "Falha no parse" }, { status: 500 });
    }
  }

  if (body.type === "refine") {
    const text = await ask(
      `Refine este slide conforme a instrução.

Slide:
- Título: "${body.slide.titulo}"
- Subtítulo: "${body.slide.subtitulo}"

Instrução: "${body.instruction}"

${NO_DASH_RULE}
Responda APENAS com JSON, sem markdown:
{ "titulo": "...", "subtitulo": "..." }`,
      1200
    );
    if (!text) {
      return NextResponse.json({ error: "Sem resposta" }, { status: 500 });
    }

    try {
      const refined = extractJson<{ titulo: string; subtitulo: string }>(
        text,
        false
      );
      return NextResponse.json({
        titulo: stripTravessao(refined.titulo),
        subtitulo: stripTravessao(refined.subtitulo),
      });
    } catch {
      return NextResponse.json({ error: "Falha no parse" }, { status: 500 });
    }
  }

  if (body.type === "improve") {
    const slidesText = body.slides
      .map((s, i) => `Slide ${i + 1}: "${s.titulo}" — "${s.subtitulo}"`)
      .join("\n");

    const text = await ask(
      `Melhore todos os slides conforme a instrução.

Slides:
${slidesText}

Instrução: "${body.instruction}"

${NO_DASH_RULE}
Responda APENAS com JSON array com TODOS os slides melhorados, sem markdown:
[{ "titulo": "...", "subtitulo": "..." }]`,
      6000
    );
    if (!text) {
      return NextResponse.json({ error: "Sem resposta" }, { status: 500 });
    }

    try {
      const slides = extractJson<{ titulo: string; subtitulo: string }[]>(
        text,
        true
      ).map((s) => ({
        titulo: stripTravessao(s.titulo),
        subtitulo: stripTravessao(s.subtitulo),
      }));
      return NextResponse.json({ slides });
    } catch {
      return NextResponse.json({ error: "Falha no parse" }, { status: 500 });
    }
  }

  if (body.type === "caption") {
    const slidesText = body.slides
      .map((s, i) => `Slide ${i + 1}: "${s.titulo}" — "${s.subtitulo}"`)
      .join("\n");

    const text = await ask(
      `Crie uma legenda completa para o Instagram com base nesses slides:

${slidesText}

Inclua: gancho inicial, desenvolvimento do tema, chamada para ação e hashtags relevantes.
${NO_DASH_RULE}
Responda apenas com o texto da legenda, sem JSON.`,
      2400
    );
    if (!text) {
      return NextResponse.json({ error: "Sem resposta" }, { status: 500 });
    }

    return NextResponse.json({ caption: stripTravessao(text.trim()) });
  }

  return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
}
