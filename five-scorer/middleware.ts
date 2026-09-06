import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Vérification optimiste : la présence du cookie de session suffit pour
// laisser passer, chaque page/API refait la vraie vérification (session +
// appartenance au club) côté serveur via lib/guard.ts.

const AUTH_PAGES = ["/login", "/signup"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(getSessionCookie(req));

  // Déjà connecté → pas de raison de revoir login/signup.
  if (AUTH_PAGES.includes(pathname) && hasSession) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // Espace club + onboarding : session requise.
  const isProtected =
    pathname.startsWith("/c/") || pathname === "/onboarding";
  if (isProtected && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // API de sync (outbox offline) : 401 propre plutôt qu'une redirection HTML.
  if (pathname.startsWith("/api/clubs/") && !hasSession) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|fonts|manifest.webmanifest|sw.js|api/auth).*)",
  ],
};
