import { NextResponse } from "next/server";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getCurrentUserProfile } from "@/services/users";
import { MagnificOAuthProvider } from "@/lib/magnific/oauth-provider";

const MAGNIFIC_MCP_URL = "https://mcp.magnific.com";

export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const code = new URL(request.url).searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Parâmetro code ausente" }, { status: 400 });
  }

  // Instância nova, de propósito: authorize (route.ts) e callback rodam em invocações
  // serverless separadas — o provider recarrega client_information/code_verifier do banco.
  const transport = new StreamableHTTPClientTransport(new URL(MAGNIFIC_MCP_URL), {
    authProvider: new MagnificOAuthProvider(),
  });

  try {
    await transport.finishAuth(code);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { error: `Falha ao finalizar autorização: ${message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, message: "Magnific autorizado com sucesso." });
}
