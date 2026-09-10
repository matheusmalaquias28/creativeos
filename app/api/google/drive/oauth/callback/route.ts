import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  exchangeGoogleAuthCode,
  fetchGoogleAccountEmail,
  saveGoogleDriveConnection,
} from "@/lib/google/oauth";

export async function GET(request: Request) {
  const user = await getAuthUser();
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const returnTo = cookieStore.get("gdrive_oauth_return")?.value || "/demands";
  const expectedState = cookieStore.get("gdrive_oauth_state")?.value;
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  cookieStore.delete("gdrive_oauth_state");
  cookieStore.delete("gdrive_oauth_return");

  const redirectWith = (query: string) =>
    NextResponse.redirect(new URL(`${returnTo}${query}`, url.origin));

  if (!user) {
    return redirectWith("?drive_error=auth");
  }
  if (oauthError) {
    return redirectWith("?drive_error=denied");
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWith("?drive_error=state");
  }

  try {
    const tokens = await exchangeGoogleAuthCode({ code, origin: url.origin });
    const email = await fetchGoogleAccountEmail(tokens.accessToken);
    await saveGoogleDriveConnection({
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
      email,
      connectedBy: user.id,
    });
    return redirectWith("?drive_connected=1");
  } catch (error) {
    console.error("[google/drive/oauth]", error);
    return redirectWith("?drive_error=token");
  }
}
