import { NextResponse } from "next/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { getCurrentUserProfile } from "@/services/users";
import { MagnificOAuthProvider } from "@/lib/magnific/oauth-provider";

const MAGNIFIC_MCP_URL = "https://mcp.magnific.com";

/**
 * Bootstrap OAuth de uso único: um admin abre esta rota logado, aprova o acesso no
 * Magnific, e a partir daí o refresh_token salvo no banco sustenta as chamadas
 * headless do backend indefinidamente (ver lib/magnific/oauth-provider.ts).
 */
export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  let redirectTo: URL | null = null;
  const provider = new MagnificOAuthProvider((url) => {
    console.log("[magnific/oauth] redirectToAuthorization ->", url.toString());
    redirectTo = url;
  });

  const client = new Client({ name: "creative-os", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MAGNIFIC_MCP_URL), {
    authProvider: provider,
  });

  const start = Date.now();
  console.log("[magnific/oauth] connecting to", MAGNIFIC_MCP_URL);

  try {
    await client.connect(transport);
    console.log("[magnific/oauth] connected without auth challenge in", Date.now() - start, "ms");
    return NextResponse.json({ ok: true, message: "Magnific já está autorizado." });
  } catch (error) {
    console.log("[magnific/oauth] connect() threw after", Date.now() - start, "ms");
    console.error("[magnific/oauth] error:", error);

    if (error instanceof UnauthorizedError && redirectTo) {
      return NextResponse.redirect(redirectTo);
    }
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      {
        error: message,
        errorName: error instanceof Error ? error.name : typeof error,
        gotRedirect: Boolean(redirectTo),
      },
      { status: 500 }
    );
  }
}
