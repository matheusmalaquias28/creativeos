import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/ai/client";
import {
  BUILD_CAROUSEL_TOOL,
  buildSystemPrompt,
  type TurboSpec,
} from "@/lib/carousel/turbo/schema";
import { stripTravessao } from "@/lib/text/strip-dash";
import type { CarouselProfile } from "@/types/carousel-profile";

export const maxDuration = 120;

const TURBO_MODEL = "claude-sonnet-4-6";

type ContentBody = { profileId: string; theme: string; cardCount?: number };

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401 });

  let body: ContentBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body inválido" }), { status: 400 });
  }
  const theme = body.theme?.trim();
  if (!body.profileId || !theme) {
    return new Response(JSON.stringify({ error: "Perfil e tema são obrigatórios" }), { status: 400 });
  }
  const cardCount =
    body.cardCount && body.cardCount >= 3 && body.cardCount <= 10
      ? Math.round(body.cardCount)
      : undefined;

  const { data: profileData } = await supabase
    .from("carousel_profiles")
    .select("*")
    .eq("id", body.profileId)
    .single();
  const profile = profileData as CarouselProfile | null;
  if (!profile) return new Response(JSON.stringify({ error: "Perfil não encontrado" }), { status: 404 });

  const encoder = new TextEncoder();
  const anthropic = getAnthropicClient();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        send({ type: "status", message: "Pesquisando o tema e pensando na narrativa…" });

        const tools = [
          { type: "web_search_20250305", name: "web_search", max_uses: 4 },
          BUILD_CAROUSEL_TOOL,
        ] as Anthropic.Messages.ToolUnion[];

        const aStream = anthropic.messages.stream({
          model: TURBO_MODEL,
          max_tokens: 6000,
          system: buildSystemPrompt(profile, theme, cardCount),
          messages: [
            {
              role: "user",
              content:
                "Pesquise o tema com dados atuais e gere o conteúdo do carrossel. Ao final, chame a ferramenta build_carousel com o resultado completo.",
            },
          ],
          tools,
        });

        aStream.on("text", (t) => send({ type: "text", delta: t }));

        const final = await aStream.finalMessage();

        let spec: TurboSpec | null = null;
        const toolBlock = final.content.find(
          (b) => b.type === "tool_use" && b.name === "build_carousel"
        );
        if (toolBlock && toolBlock.type === "tool_use") {
          spec = toolBlock.input as TurboSpec;
        } else {
          const textBlock = final.content.find((b) => b.type === "text");
          if (textBlock && textBlock.type === "text") {
            const m = textBlock.text.match(/\{[\s\S]*\}/);
            if (m) {
              try {
                spec = JSON.parse(m[0]) as TurboSpec;
              } catch {
                /* ignore */
              }
            }
          }
        }

        if (!spec || !Array.isArray(spec.slides) || spec.slides.length === 0) {
          send({ type: "error", message: "A IA não retornou um conteúdo válido. Tente de novo." });
        } else {
          // Safety net: strip any travessão the model may have produced.
          spec.slides = spec.slides.map((s) => ({
            ...s,
            titulo: stripTravessao(s.titulo),
            subtitulo: stripTravessao(s.subtitulo),
            cta: s.cta?.text ? { text: stripTravessao(s.cta.text) } : s.cta,
          }));
          if (spec.caption) spec.caption = stripTravessao(spec.caption);
          send({ type: "spec", spec });
        }
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "Erro na geração" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
