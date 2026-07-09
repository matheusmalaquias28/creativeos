import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/services/users";

const TARGETS = [
  { name: "mcp-well-known", url: "https://mcp.magnific.com/.well-known/oauth-protected-resource" },
  { name: "auth-well-known-oauth", url: "https://auth.magnific.com/.well-known/oauth-authorization-server" },
  {
    name: "auth-well-known-oidc-realm",
    url: "https://auth.magnific.com/realms/mcp/.well-known/openid-configuration",
  },
  { name: "control-external", url: "https://example.com" },
];

async function probe(name: string, url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const start = Date.now();
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "manual" });
    return {
      name,
      url,
      ok: true,
      status: response.status,
      ms: Date.now() - start,
    };
  } catch (error) {
    return {
      name,
      url,
      ok: false,
      ms: Date.now() - start,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Diagnóstico temporário — remover depois de resolver o timeout do bootstrap OAuth. */
export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const results = await Promise.all(TARGETS.map((t) => probe(t.name, t.url)));
  return NextResponse.json({ results });
}
