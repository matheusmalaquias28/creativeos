import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const body = await req.json() as { base64: string; mimeType: string };

  if (!body.base64 || !body.mimeType) {
    return NextResponse.json({ error: "base64 e mimeType obrigatórios" }, { status: 400 });
  }

  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: body.mimeType as "image/jpeg" | "image/png" | "image/webp",
              data: body.base64,
            },
          },
          {
            type: "text",
            text: `Analise esta imagem como diretor de arte e extraia o DNA visual em linguagem de prompt de geração de imagem.

Cubra: composição e enquadramento, paleta de cores e temperatura, tipo e direção de iluminação, mood e atmosfera, estilo fotográfico, textura e acabamento, organização dos elementos e uso de espaço negativo.

Escreva em inglês, em parágrafo fluido como um prompt técnico de direção de arte — sem bullets nem títulos. Máximo 150 palavras.`,
          },
        ],
      },
    ],
  });

  const dna = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  return NextResponse.json({ dna });
}
