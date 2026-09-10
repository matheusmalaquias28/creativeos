import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  buildGoogleAuthUrl,
  isGoogleOAuthAppConfigured,
} from "@/lib/google/oauth";

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/demands";
  return value;
}

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!isGoogleOAuthAppConfigured()) {
    return NextResponse.json(
      {
        error:
          "Falta GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET no Vercel. Crie um OAuth Client (aplicativo da Web) no Google Cloud.",
      },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  const secure = url.protocol === "https:";
  cookieStore.set("gdrive_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 600,
  });
  cookieStore.set("gdrive_oauth_return", safeReturnTo(url.searchParams.get("returnTo")), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildGoogleAuthUrl({ origin: url.origin, state }));
}
