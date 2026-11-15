import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Proxy (ex-middleware) : rafraîchit la session Supabase et protège les routes privées.
 * Limité par `matcher` aux seules routes concernées : la page d'accueil et la page de
 * paiement publique restent servies sans aucun traitement.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith("/dashboard") || path.startsWith("/onboarding") || path.startsWith("/reset-password");
  const isAuthPage = path === "/login" || path === "/signup";

  if (!isSupabaseConfigured) {
    return isProtected ? NextResponse.redirect(new URL("/login", request.url)) : NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Valide le jeton (localement si le projet utilise des clés asymétriques) et le rafraîchit si besoin.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const redirectTo = (pathname: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!signedIn && isProtected) {
    return redirectTo("/login", `?next=${encodeURIComponent(path + request.nextUrl.search)}`);
  }
  if (signedIn && isAuthPage) {
    return redirectTo("/dashboard");
  }
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding", "/reset-password", "/login", "/signup"],
};
