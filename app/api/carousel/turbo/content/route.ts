import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openaiJsonStream, responseText } from "@/lib/ai/openai-text";
import {
  BUILD_CAROUSEL_TOOL,
  buildSystemPrompt,
  type TurboSpec,
} from "@/lib/carousel/turbo/schema";
import { stripTravessao } from "@/lib/text/strip-dash";
import type { CarouselProfile } from "@/types/carousel-profile";

export const maxDuration = 120;


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

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        send({ type: "status", message: "Pesquisando o tema e pensando na narrativa…" });

        // Pesquisa na web (ferramenta nativa da OpenAI) e devolve o carrossel no
        // schema do build_carousel. O resumo do raciocínio vai para o painel
        // "pensando" da UI; buscas viram status.
        let searches = 0;
        let writing = false;
        const final = await openaiJsonStream(
          {
            system: buildSystemPrompt(profile, theme, cardCount),
            input:
              "Pesquise o tema com dados atuais e gere o conteúdo do carrossel completo no formato pedido.",
            tools: [{ type: "web_search" }],
            schemaName: BUILD_CAROUSEL_TOOL.name,
            // Schema com campos opcionais (cta, gridPrompts, textGlass): modo não-estrito.
            jsonSchema: BUILD_CAROUSEL_TOOL.input_schema,
            strict: false,
            maxOutputTokens: 24000,
            reasoningEffort: "medium",
            timeoutMs: 115_000,
          },
          (evt) => {
            if (evt.type === "response.reasoning_summary_text.delta" && evt.delta) {
              send({ type: "text", delta: evt.delta });
            } else if (evt.type === "response.reasoning_summary_part.done") {
              send({ type: "text", delta: "\n\n" });
            } else if (evt.type === "response.web_search_call.searching") {
              searches += 1;
              send({ type: "status", message: `Pesquisando na web (${searches})…` });
            } else if (evt.type === "response.output_text.delta" && !writing) {
              writing = true;
              send({ type: "status", message: "Montando o carrossel…" });
            }
          }
        );

        let spec: TurboSpec | null = null;
        try {
          spec = JSON.parse(responseText(final)) as TurboSpec;
        } catch {
          spec = null;
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
