import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { verdictProtocole } from "@/lib/protocole";

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

  // Les routes que l'app mobile appelle. Deux choses s'y jouent :
  //
  //   1. un 401 propre plutôt qu'une redirection HTML — la file d'attente de
  //      l'app doit pouvoir distinguer « reconnecte-toi » d'une page de login ;
  //   2. le verdict de version, posé en en-tête de réponse.
  //
  // Le verdict est posé QUE LA SESSION SOIT VALIDE OU NON : c'est une
  // métadonnée de transport, pas un droit d'accès. Le poser seulement sur les
  // réponses authentifiées obligerait le script de vérification à tenir un
  // vrai cookie pour éprouver trois comparaisons d'entiers.
  if (pathname.startsWith("/api/clubs/")) {
    const res = hasSession
      ? NextResponse.next()
      : NextResponse.json({ error: "unauthorized" }, { status: 401 });
    // Jamais un refus : l'app est PRÉVENUE, elle n'est pas bloquée. Au gymnase
    // sans réseau, un blocage transformerait une incompatibilité en soirée
    // perdue (spec 0004, Q4).
    res.headers.set("x-protocole-verdict", verdictProtocole(req.headers.get("x-protocole")));
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|fonts|manifest.webmanifest|sw.js|api/auth|api/cal|api/public).*)",
  ],
};
