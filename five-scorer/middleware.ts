import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Vérification optimiste : la présence du cookie de session suffit pour
// laisser passer, chaque page/API refait la vraie vérification (session +
// appartenance au club) côté serveur via lib/guard.ts.

const AUTH_PAGES = ["/login", "/signup"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(getSessionCookie(req));

  // Le cookie est jugé sur sa seule PRÉSENCE : ni signature, ni lecture de
  // base. Il peut donc désigner une session que le serveur ne reconnaît plus
  // (ligne supprimée, BETTER_AUTH_SECRET changé) et rester sept jours dans le
  // navigateur. Sans le garde ci-dessous, deux règles se renvoient la balle —
  // ici /login → /onboarding, et la garde d'accès /onboarding → /login — et le
  // navigateur boucle jusqu'à ERR_TOO_MANY_REDIRECTS : plus une seule page ne
  // s'affiche. La sortie de secours doit donc toujours pouvoir atteindre
  // /login pour y faire nettoyer le cookie.
  const sortieDeSecours = req.nextUrl.searchParams.get("session") === "expiree";

  // Déjà connecté → pas de raison de revoir login/signup.
  if (AUTH_PAGES.includes(pathname) && hasSession && !sortieDeSecours) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // Espace club + onboarding : session requise.
  const isProtected = pathname.startsWith("/c/") || pathname === "/onboarding";
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
    "/((?!_next/static|_next/image|favicon.ico|icons|fonts|manifest.webmanifest|sw.js|api/auth|api/cal|api/public).*)",
  ],
};
