import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccessPath, homePathFor, parseRole } from "@/lib/auth/permissions";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth");
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/clients") ||
    request.nextUrl.pathname.startsWith("/demands");

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const role = user ? parseRole(user.app_metadata?.role) : null;

  if (user && role && isAuthRoute && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = homePathFor(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Permissões por role: páginas redirecionam para a home da role, APIs recebem 403.
  if (user && role && !canAccessPath(role, request.nextUrl.pathname)) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sem permissão para este recurso" }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = homePathFor(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
