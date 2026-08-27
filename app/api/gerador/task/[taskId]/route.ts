import { NextRequest, NextResponse } from "next/server";

const MAGNIFIC_API = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const key = process.env.MAGNIFIC_API_KEY;
  if (!key) return NextResponse.json({ error: "MAGNIFIC_API_KEY não configurada" }, { status: 500 });

  const { taskId } = await params;

  const res = await fetch(`${MAGNIFIC_API}/${taskId}`, {
    headers: { "x-magnific-api-key": key },
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: data?.message ?? "Erro ao buscar task" }, { status: res.status });
  }

  const { task_id, status, generated } = data.data;
  return NextResponse.json({ taskId: task_id, status, generated: generated ?? [] });
}
