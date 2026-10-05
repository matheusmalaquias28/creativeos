import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  cutoutFromUrl,
  editStudioImage,
  generateStudioImage,
  wrapOperatorPrompt,
  type StudioImageKind,
} from "@/lib/carousel-studio/images";
import type { StudioBrandKit } from "@/types/carousel-studio";

export const maxDuration = 180;

type Params = { params: Promise<{ id: string }> };

type Body =
  | { mode: "generate"; kind: StudioImageKind; prompt: string; aspectRatio: string; raw?: boolean }
  | { mode: "edit"; kind: StudioImageKind; sourceUrl: string; instruction: string; aspectRatio: string }
  | { mode: "cutout"; sourceUrl: string };

const ASPECTS = new Set(["1:1", "4:5", "3:4", "9:16", "4:3", "16:9"]);

/**
 * Imagem de uma camada, sob demanda no editor: gerar nova (fundo/elemento),
 * editar a atual por instrução, ou recortar o fundo. Síncrono — devolve a URL.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { data: row } = await supabase
    .from("studio_carousels")
    .select("id, demand_id, brand, reference_urls")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Carrossel não encontrado" }, { status: 404 });

  const kind: StudioImageKind = "kind" in body && body.kind === "element" ? "element" : "background";
  const aspectRatio = "aspectRatio" in body && ASPECTS.has(body.aspectRatio) ? body.aspectRatio : "4:5";

  try {
    if (body.mode === "cutout") {
      if (!body.sourceUrl) return NextResponse.json({ error: "Imagem não informada" }, { status: 400 });
      const result = await cutoutFromUrl(id, body.sourceUrl);
      if (!result.removed) {
        return NextResponse.json({ error: "O fundo dessa imagem não é liso o bastante para recortar automaticamente." }, { status: 422 });
      }
      return NextResponse.json(result);
    }

    if (body.mode === "edit") {
      if (!body.sourceUrl || !body.instruction?.trim()) {
        return NextResponse.json({ error: "Diga o que mudar na imagem" }, { status: 400 });
      }
      return NextResponse.json(
        await editStudioImage({ carouselId: id, kind, sourceUrl: body.sourceUrl, instruction: body.instruction, aspectRatio })
      );
    }

    if (body.mode === "generate") {
      if (!body.prompt?.trim()) return NextResponse.json({ error: "Descreva a imagem" }, { status: 400 });
      const brand = (row.brand ?? {}) as Partial<StudioBrandKit>;
      const { data: refs } = row.demand_id
        ? await supabase.from("demand_reference_image").select("storage_url").eq("demand_id", row.demand_id)
        : { data: [] as { storage_url: string }[] };
      const referenceUrls = [
        ...(refs ?? []).map((r) => r.storage_url),
        ...((row.reference_urls as string[] | null) ?? []),
        ...(brand.referenceUrls ?? []),
      ];
      // Prompts que já vieram do diretor de arte têm as regras embutidas.
      const prompt = body.raw ? body.prompt : wrapOperatorPrompt(kind, body.prompt);
      return NextResponse.json(await generateStudioImage({ carouselId: id, kind, prompt, aspectRatio, referenceUrls }));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar a imagem";
    console.error("[carousel-studio/image]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
}
