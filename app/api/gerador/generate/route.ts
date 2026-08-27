import { NextRequest, NextResponse } from "next/server";

const MAGNIFIC_API = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro";

type ReferenceImage = {
  image: string;
  mime_type: "image/png" | "image/jpeg" | "image/webp";
  text?: string;
};

type GenerateBody = {
  prompt: string;
  aspect_ratio?: string;
  resolution?: string;
  reference_images?: ReferenceImage[];
};

export async function POST(req: NextRequest) {
  const key = process.env.MAGNIFIC_API_KEY;
  if (!key) return NextResponse.json({ error: "MAGNIFIC_API_KEY não configurada" }, { status: 500 });

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "Prompt obrigatório" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    prompt: body.prompt.trim(),
    aspect_ratio: body.aspect_ratio ?? "1:1",
    resolution: body.resolution ?? "2K",
  };

  if (body.reference_images?.length) {
    payload.reference_images = body.reference_images;
  }

  const res = await fetch(MAGNIFIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-magnific-api-key": key,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: data?.message ?? "Erro na API Magnific" }, { status: res.status });
  }

  return NextResponse.json({ taskId: data.data.task_id });
}
