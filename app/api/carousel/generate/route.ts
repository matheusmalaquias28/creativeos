import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAnthropicClient,
  DEFAULT_CLAUDE_MODEL,
} from "@/lib/ai/client";
import type { CarouselSlide } from "@/types/carousel";

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
  const anthropic = getAnthropicClient();

  if (body.type === "slides") {
    const count = Math.min(Math.max(body.slideCount ?? 5, 1), 20);
    const msg = await anthropic.messages.create({
      model: DEFAULT_CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Crie ${count} slides para um carrossel do Instagram sobre: "${body.prompt}".

Responda APENAS com um JSON array, sem markdown:
[
  { "titulo": "TÍTULO IMPACTANTE", "subtitulo": "Frase de apoio direta (1-2 linhas)" }
]

Regras:
- Títulos curtos, diretos e impactantes (máx 8 palavras)
- Subtítulos complementam o título (máx 20 palavras)
- Nenhum texto além do JSON`,
        },
      ],
    });

    const text = msg.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return NextResponse.json({ error: "Sem resposta" }, { status: 500 });
    }

    try {
      const slides = extractJson<{ titulo: string; subtitulo: string }[]>(
        text.text,
        true
      );
      return NextResponse.json({ slides });
    } catch {
      return NextResponse.json({ error: "Falha no parse" }, { status: 500 });
    }
  }

  if (body.type === "refine") {
    const msg = await anthropic.messages.create({
      model: DEFAULT_CLAUDE_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Refine este slide conforme a instrução.

Slide:
- Título: "${body.slide.titulo}"
- Subtítulo: "${body.slide.subtitulo}"

Instrução: "${body.instruction}"

Responda APENAS com JSON, sem markdown:
{ "titulo": "...", "subtitulo": "..." }`,
        },
      ],
    });

    const text = msg.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return NextResponse.json({ error: "Sem resposta" }, { status: 500 });
    }

    try {
      const refined = extractJson<{ titulo: string; subtitulo: string }>(
        text.text,
        false
      );
      return NextResponse.json(refined);
    } catch {
      return NextResponse.json({ error: "Falha no parse" }, { status: 500 });
    }
  }

  if (body.type === "improve") {
    const slidesText = body.slides
      .map((s, i) => `Slide ${i + 1}: "${s.titulo}" — "${s.subtitulo}"`)
      .join("\n");

    const msg = await anthropic.messages.create({
      model: DEFAULT_CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Melhore todos os slides conforme a instrução.

Slides:
${slidesText}

Instrução: "${body.instruction}"

Responda APENAS com JSON array com TODOS os slides melhorados, sem markdown:
[{ "titulo": "...", "subtitulo": "..." }]`,
        },
      ],
    });

    const text = msg.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return NextResponse.json({ error: "Sem resposta" }, { status: 500 });
    }

    try {
      const slides = extractJson<{ titulo: string; subtitulo: string }[]>(
        text.text,
        true
      );
      return NextResponse.json({ slides });
    } catch {
      return NextResponse.json({ error: "Falha no parse" }, { status: 500 });
    }
  }

  if (body.type === "caption") {
    const slidesText = body.slides
      .map((s, i) => `Slide ${i + 1}: "${s.titulo}" — "${s.subtitulo}"`)
      .join("\n");

    const msg = await anthropic.messages.create({
      model: DEFAULT_CLAUDE_MODEL,
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `Crie uma legenda completa para o Instagram com base nesses slides:

${slidesText}

Inclua: gancho inicial, desenvolvimento do tema, chamada para ação e hashtags relevantes.
Responda apenas com o texto da legenda, sem JSON.`,
        },
      ],
    });

    const text = msg.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return NextResponse.json({ error: "Sem resposta" }, { status: 500 });
    }

    return NextResponse.json({ caption: text.text.trim() });
  }

  return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
}
