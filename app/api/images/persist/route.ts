import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  persistImageFromUrl,
  type GeneratedImageSource,
} from "@/lib/images/persist-image";

const SOURCES: GeneratedImageSource[] = [
  "carousel-turbo",
  "carousel-editor",
  "gerador",
  "artes",
];

type PersistBody = {
  url: string;
  source?: GeneratedImageSource;
  prompt?: string;
  aspectRatio?: string;
  resolution?: string;
};

/** Baixa uma URL temporária de imagem gerada e devolve a URL permanente no Storage. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: PersistBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!body.url || !/^https:\/\//.test(body.url)) {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }
  const source = SOURCES.includes(body.source as GeneratedImageSource)
    ? (body.source as GeneratedImageSource)
    : "carousel-editor";

  const persisted = await persistImageFromUrl({
    url: body.url,
    source,
    userId: user.id,
    prompt: body.prompt,
    aspectRatio: body.aspectRatio,
    resolution: body.resolution,
  });

  return NextResponse.json({ url: persisted.url, id: persisted.id });
}
