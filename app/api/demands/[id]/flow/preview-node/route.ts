import { NextResponse } from "next/server";
import { IMAGE_GEN_DEFAULTS } from "@/lib/ai/imagegen/defaults";
import { MAX_REFERENCES } from "@/lib/ai/imagegen/openai";
import {
  buildSpaceRequest,
  spacePromptFor,
  spaceReferencesFor,
  type SpaceJobParams,
} from "@/lib/ai/imagegen/space-request";
import { flowJobParamsToRow } from "@/lib/flow/extract-flow-jobs";
import { extractNodeJob } from "@/lib/flow/node-job";

type Params = { params: Promise<{ id: string }> };

/**
 * Preview do que um node arte manda para a geração: prompt, referências (na
 * ordem enviada) e o lote. Usa a MESMA montagem do worker (`buildSpaceRequest`)
 * sobre o fluxo salvo — o que aparece no node é exatamente o que vai.
 */
export async function GET(req: Request, { params }: Params) {
  const { id: demandId } = await params;
  const artIndex = Number(new URL(req.url).searchParams.get("artIndex"));
  if (!Number.isInteger(artIndex)) {
    return NextResponse.json({ error: "artIndex é obrigatório" }, { status: 400 });
  }

  const result = await extractNodeJob(demandId, artIndex);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const request = buildSpaceRequest(flowJobParamsToRow(result.job) as SpaceJobParams, {
    aspectRatio: IMAGE_GEN_DEFAULTS.aspectRatio,
    imageSize: IMAGE_GEN_DEFAULTS.imageSize,
  });

  // Referências de UMA geração (no fan-out, o item da lista entra como Imagem 1).
  const firstItem = request.batch[0] ?? null;
  const firstGeneration = spaceReferencesFor(request, firstItem);

  return NextResponse.json({
    prompt: spacePromptFor(request, firstItem),
    references: firstGeneration.slice(0, MAX_REFERENCES),
    droppedReferences: Math.max(0, firstGeneration.length - MAX_REFERENCES),
    batch: request.batch.map((item) => item?.url ?? null),
    aspectRatio: request.aspectRatio,
    imageSize: request.imageSize,
    quality: request.quality,
  });
}
