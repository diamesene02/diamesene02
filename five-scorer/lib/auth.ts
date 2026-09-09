import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

// Auth centrale : comptes email/mot de passe (+ Google si configuré) et
// organizations = clubs. Le profil sportif du club (format, barème, options)
// vit dans la table `club`, créée dans le hook afterCreate ci-dessous.

const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET);

/// Un déploiement de prévisualisation répond sur DEUX adresses : l'alias
/// stable de la branche (VERCEL_BRANCH_URL), celle qu'on ouvre depuis la
/// pull request, et l'adresse unique du déploiement (VERCEL_URL). Il faut
/// les connaître toutes les deux.
///
/// C'est le piège dans lequel on est tombé : baseURL réglée sur VERCEL_URL
/// alors que le navigateur arrivait par l'alias de branche. Better Auth
/// compare l'origine de la requête à ses origines de confiance et répond
/// « INVALID_ORIGIN » — que l'écran d'inscription traduisait, à tort, par
/// « cet email est déjà utilisé ».
function previewUrls(): string[] {
  if (process.env.VERCEL_ENV !== "preview") return [];
  return [process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL]
    .filter((host): host is string => Boolean(host))
    .map((host) => `https://${host}`);
}

/// L'URL sur laquelle l'app se croit servie — base des redirections après
/// connexion et des callbacks OAuth. En production, l'URL canonique ; en
/// prévisualisation, l'alias de branche, seul stable d'un déploiement à
/// l'autre.
function resolveBaseUrl(): string | undefined {
  return previewUrls()[0] ?? process.env.BETTER_AUTH_URL;
}

/// Les origines dont Better Auth accepte les requêtes. On y met les deux
/// adresses de prévisualisation en plus de l'URL canonique, plus les schémas
/// de l'application React Native.
function trustedOrigins(): string[] {
  const origins = previewUrls();
  if (process.env.BETTER_AUTH_URL) origins.push(process.env.BETTER_AUTH_URL);

  // Le schéma de l'app native, celui qu'un build signé utilisera.
  origins.push("fivescorer://");

  // Expo Go, EN DÉVELOPPEMENT SEULEMENT.
  //
  // Le hook `after` du plugin serveur recopie l'en-tête `set-cookie` — donc le
  // jeton de session en clair — dans l'URL de redirection dès que la
  // destination est une origine de confiance à schéma non-http. En production,
  // seul `fivescorer://` doit l'être : `exp://` y donnerait à n'importe quelle
  // app Expo un moyen de récupérer une session.
  //
  // Les DEUX schémas sont nécessaires : dès qu'on lance `expo start --tunnel`
  // — le recours normal quand le téléphone n'est pas sur le Wi-Fi du Mac —
  // expo-linking bascule le lien de callback sur `exps://`, et le motif
  // `exp://` ne le couvre pas.
  if (process.env.NODE_ENV === "development") {
    origins.push("exp://", "exps://");
  }
  return origins;
}

export const auth = betterAuth({
  appName: "Five Scorer",
  baseURL: resolveBaseUrl(),
  trustedOrigins: trustedOrigins(),
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  socialProviders: googleConfigured
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : undefined,
  session: {
    // Le club joue une fois par semaine. Avec l'expiration par défaut (7
    // jours), une semaine de vacances ou quelques minutes de retard suffisaient
    // à retomber sur /login au gymnase, sans réseau pour se reconnecter. 90
    // jours, renouvelés à chaque visite : une session ne meurt qu'après un
    // trimestre sans jouer.
    expiresIn: 60 * 60 * 24 * 90,
    updateAge: 60 * 60 * 24,
    // Évite un aller-retour DB par requête : la session est encodée dans un
    // cookie signé, revalidée toutes les 5 minutes.
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  plugins: [
    organization({
      // Un utilisateur peut gérer plusieurs clubs (son five du jeudi + le
      // club du dimanche) mais on borne pour éviter l'abus.
      organizationLimit: 10,
      organizationHooks: {
        afterCreateOrganization: async ({ organization: org, user }) => {
          await prisma.club.create({ data: { id: org.id } });
          // Le créateur a d'office son profil joueur, lié à son compte.
          await prisma.player.create({
            data: { clubId: org.id, name: user.name, userId: user.id },
          });
        },
      },
    }),
    // L'application React Native : rejeu du cookie de session depuis le
    // trousseau du téléphone, et gestion du retour de connexion par lien
    // profond. Rien ne change pour le web.
    expo(),
    // Doit rester en dernier : synchronise les cookies dans les server actions.
    // (Better Auth le vérifie lui-même — cf. warnIfCookiePluginNotLast.)
    nextCookies(),
  ],
});

export type ServerSession = typeof auth.$Infer.Session;
