// Crée (ou remet d'aplomb) le compte de développement utilisé pour essayer
// l'app mobile dans Expo Go. Le compte réel d'Ibrahima vit en production ; la
// base locale ne le connaît pas, et la connexion depuis Expo Go ne peut viser
// que le serveur du Mac — d'où ce compte-ci.
//
// On passe par l'API de Better Auth plutôt que par Prisma : c'est elle qui
// sait hacher le mot de passe et remplir la table `account`. Écrire le hachage
// à la main, c'est exactement le genre de détail qui casse en silence à la
// prochaine montée de version.
//
//   node scripts/compte-dev.mjs          (le serveur de dev doit tourner)
import { PrismaClient } from "@prisma/client";

export const COURRIEL = "dev@five.local";
export const MOT_DE_PASSE = "demo-five-2026";
const NOM = "Compte de dev";
const BASE = process.env.BASE ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

const prisma = new PrismaClient();

const refus = (r, t) => { throw new Error(`${r.status} ${t}`); };

async function inscrire() {
  const r = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: COURRIEL, password: MOT_DE_PASSE, name: NOM }),
  });
  const t = await r.text();
  if (r.ok) return "créé";
  if (t.includes("USER_ALREADY_EXISTS") || t.includes("already exists")) return "existant";
  refus(r, t);
}

async function motDePasseBon() {
  const r = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: COURRIEL, password: MOT_DE_PASSE }),
  });
  return r.ok;
}

async function verifier() {
  if (!(await motDePasseBon())) throw new Error("la connexion échoue encore");
}

/// Un compte laissé par un essai précédent peut porter un autre mot de passe,
/// et rien dans l'API ne permet de le remettre sans être déjà connecté. On
/// efface donc le compte pour le recréer proprement — c'est sans risque, la
/// garde ci-dessous interdit de tourner sur autre chose qu'une base locale.
async function repartirDeZero() {
  const u = await prisma.user.findUnique({ where: { email: COURRIEL } });
  if (u) await prisma.user.delete({ where: { id: u.id } });
}

async function main() {
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("DATABASE_URL ne pointe pas sur une base locale — refus.");
  }
  let etat = await inscrire();
  if (etat === "existant" && !(await motDePasseBon())) {
    await repartirDeZero();
    etat = await inscrire() === "créé" ? "recréé" : "existant";
  }
  console.log("compte :", etat);

  const user = await prisma.user.findUnique({ where: { email: COURRIEL } });
  if (!user) throw new Error("utilisateur introuvable après inscription");

  // Le club qui ressemble le plus au vrai : chasubles blanc et noir.
  const org = await prisma.organization.findFirst({
    where: { slug: "fc-testeurs" },
    select: { id: true, name: true, slug: true },
  });
  if (!org) throw new Error("aucun club local ; lance d'abord le seed");

  const deja = await prisma.member.findFirst({
    where: { organizationId: org.id, userId: user.id },
  });
  if (!deja) {
    await prisma.member.create({
      data: {
        id: `mbr_${user.id.slice(0, 12)}`,
        organizationId: org.id,
        userId: user.id,
        role: "owner",
        createdAt: new Date(),
      },
    });
  }
  // Un membre sans profil joueur voit un club sans lui dedans.
  const joueur = await prisma.player.findFirst({
    where: { clubId: org.id, userId: user.id },
  });
  if (!joueur) {
    const libre = await prisma.player.findFirst({
      where: { clubId: org.id, userId: null },
      orderBy: { name: "asc" },
    });
    if (libre) await prisma.player.update({ where: { id: libre.id }, data: { userId: user.id } });
  }

  await verifier();
  console.log(`club   : ${org.name} (${org.slug}) — rôle owner`);
  console.log(`\n  ${COURRIEL}\n  ${MOT_DE_PASSE}\n`);
}

main()
  .catch((e) => { console.error("échec :", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
