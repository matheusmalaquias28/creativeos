import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openaiJson } from "@/lib/ai/openai-text";
import { stripTravessao } from "@/lib/text/strip-dash";
import { textToCardHtml } from "@/lib/carousel/tweet/format";
import {
  BUILD_TWEET_TOOL,
  buildTweetSystemPrompt,
  type TweetContentMode,
  type TweetSpec,
} from "@/lib/carousel/tweet/prompt";
import {
  makeTweetCard,
  type TweetProfile,
  type TweetProfileSnapshot,
} from "@/types/tweet-carousel";

export const maxDuration = 90;

const MAX_INPUT = 20_000;

type GenerateBody = {
  profileId: string;
  mode: TweetContentMode;
  input: string;
  cardCount?: number;
};

/** Gera (IA) ou organiza (conteúdo próprio) os cards e cria o carrossel tweet. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const input = body.input?.trim();
  const mode: TweetContentMode = body.mode === "manual" ? "manual" : "ai";
  if (!body.profileId || !input) {
    return NextResponse.json({ error: "Perfil e conteúdo são obrigatórios" }, { status: 400 });
  }
  if (input.length > MAX_INPUT) {
    return NextResponse.json({ error: "Conteúdo muito longo (máx. 20 mil caracteres)" }, { status: 400 });
  }
  const cardCount =
    mode === "ai" && body.cardCount && body.cardCount >= 3 && body.cardCount <= 12
      ? Math.round(body.cardCount)
      : undefined;

  const { data: profileData } = await supabase
    .from("tweet_profiles")
    .select("*")
    .eq("id", body.profileId)
    .single();
  const profile = profileData as TweetProfile | null;
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  let spec: TweetSpec;
  try {
    spec = await openaiJson<TweetSpec>({
      system: buildTweetSystemPrompt({
        mode,
        profileName: profile.name,
        handle: profile.handle,
        cardCount,
      }),
      input:
        mode === "ai"
          ? `Ideia do carrossel:\n"""\n${input}\n"""`
          : `Conteúdo a organizar em cards:\n"""\n${input}\n"""`,
      schemaName: BUILD_TWEET_TOOL.name,
      jsonSchema: BUILD_TWEET_TOOL.input_schema,
      maxOutputTokens: 12000,
      reasoningEffort: "low",
      timeoutMs: 85_000,
    });
    if (!Array.isArray(spec.cards) || spec.cards.length === 0) {
      throw new Error("A IA não retornou os cards");
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao gerar o conteúdo" },
      { status: 502 }
    );
  }

  const cards = spec.cards
    .map((c) => (typeof c?.texto === "string" ? c.texto : ""))
    .filter((t) => t.trim())
    .map((t) => {
      // stripTravessao colapsa espaços; aplica por parágrafo para manter as quebras.
      const text = t
        .split(/\n/)
        .map((line) => stripTravessao(line))
        .join("\n");
      return makeTweetCard({ html: textToCardHtml(text) });
    });

  const snapshot: TweetProfileSnapshot = {
    name: profile.name,
    handle: profile.handle,
    avatarUrl: profile.avatar_url,
  };

  const { data, error } = await supabase
    .from("tweet_carousels")
    .insert({
      user_id: user.id,
      profile_id: profile.id,
      name: stripTravessao(spec.titulo?.trim() || "Carrossel tweet").slice(0, 80),
      profile: snapshot,
      cards,
      source: mode,
      source_input: input,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Erro ao salvar o carrossel" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
