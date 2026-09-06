import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// Sortie de secours pour une session devenue orpheline.
//
// La session est mise en cache dans un cookie signé pendant cinq minutes, sans
// aller-retour vers la base. Elle peut donc désigner un compte qui n'existe
// plus — supprimé, purgé, ou effacé pendant une opération de maintenance. Les
// pages protégées manipulent alors un utilisateur fantôme : au mieux elles
// affichent des données vides, au pire elles échouent sur une contrainte de clé
// étrangère, et l'utilisateur se retrouve devant une app qui ne réagit plus.
//
// Un composant serveur ne peut pas effacer un cookie ; une route, si. La garde
// d'accès redirige donc ici, et on nettoie avant de renvoyer vers la connexion.
export async function GET(request: Request) {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // La session est déjà invalide côté serveur — c'est précisément le cas
    // qu'on traite. On continue : le but est de repartir propre.
  }

  const url = new URL("/login?session=expiree", request.url);
  const res = NextResponse.redirect(url);

  // Ceinture et bretelles : si signOut n'a pas pu poser l'en-tête de
  // suppression (session déjà absente du serveur), on efface nous-mêmes les
  // cookies de Better Auth, préfixe sécurisé compris.
  // Un Set-Cookie dont le nom porte le préfixe __Secure- est REJETÉ par le
  // navigateur s'il n'a pas l'attribut Secure. Or ce sont les seuls noms qui
  // existent en production : Better Auth ajoute ce préfixe dès que la baseURL
  // est en https. Sans `secure: true`, cette route croyait nettoyer et ne
  // nettoyait rien — l'utilisateur repartait avec son cookie et retombait dans
  // la boucle que cette route existe précisément pour casser.
  for (const name of [
    "better-auth.session_token",
    "__Secure-better-auth.session_token",
    "better-auth.session_data",
    "__Secure-better-auth.session_data",
  ]) {
    res.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: name.startsWith("__Secure-"),
    });
  }

  return res;
}
