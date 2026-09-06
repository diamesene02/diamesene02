import { betterAuth } from "better-auth";
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

export const auth = betterAuth({
  appName: "Five Scorer",
  baseURL: process.env.BETTER_AUTH_URL,
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
    // Doit rester en dernier : synchronise les cookies dans les server actions.
    nextCookies(),
  ],
});

export type ServerSession = typeof auth.$Infer.Session;
