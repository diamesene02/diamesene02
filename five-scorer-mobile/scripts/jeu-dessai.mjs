// Un jeu d'essai complet, pour vérifier les endpoints de lecture SANS Mac,
// SANS téléphone et SANS toucher à la production.
//
// Pourquoi ce fichier existe : `prisma/seed.ts` ne sème rien (« chaque club se
// crée depuis l'app »), et `scripts/parcours-connexion.mjs` suppose un serveur
// qui a déjà un compte, un club et un effectif. Dans un conteneur neuf, il n'y
// a rien — donc rien à lire, donc aucune vérification honnête possible. Ce
// script fabrique le minimum : un compte, un club, un effectif, une soirée avec
// sa compo préparée, un match terminé avec ses buts, et un match en direct.
//
// Le compte et le club passent par HTTP (Better Auth et son plugin
// organization) : c'est le vrai chemin, celui que l'app emprunte. Le reste
// passe par Prisma, faute d'endpoint d'écriture pour ces objets-là.
//
//   node scripts/jeu-dessai.mjs [base]      (depuis five-scorer-mobile/)
//
// GARDE-FOU : le script refuse toute base de données qui ne soit pas locale.
// Il écrit une quinzaine de lignes en dur ; lancé par mégarde avec l'URL de
// production dans l'environnement, il polluerait le club d'Ibrahima.

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(ICI, "../../five-scorer");
const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const ORIGINE = process.env.ORIGINE ?? "exp://192.168.1.192:8090";
const COURRIEL = process.env.COURRIEL ?? "dev@five.local";
const MOT_DE_PASSE = process.env.MOT_DE_PASSE ?? "demo-five-2026";
const INTRUS = process.env.INTRUS ?? "intrus@five.local";
const MEMBRE = process.env.MEMBRE ?? "membre@five.local";

// --- garde-fou ---------------------------------------------------------------

function urlBase() {
  const brut = readFileSync(path.join(WEB, ".env"), "utf8");
  const ligne = brut.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  return (ligne ?? "").slice("DATABASE_URL=".length).replace(/^"|"$/g, "");
}

const url = urlBase();
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error(
    `REFUS : DATABASE_URL ne pointe pas vers une base locale.\n  ${url}\n` +
      "Ce script écrit des données d'essai ; il ne s'exécute que sur localhost.",
  );
  process.exit(2);
}

const require = createRequire(path.join(WEB, "package.json"));
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url } } });

// --- outils ------------------------------------------------------------------

function cookies(res) {
  const brut =
    res.headers.getSetCookie?.() ??
    [res.headers.get("set-cookie")].filter(Boolean);
  return brut.map((c) => c.split(";")[0]).join("; ");
}

const entetes = { "content-type": "application/json", origin: ORIGINE };

async function compte(courriel, nom) {
  // L'inscription est idempotente à notre échelle : si le compte existe déjà,
  // on se connecte.
  const inscription = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify({ email: courriel, password: MOT_DE_PASSE, name: nom }),
  });
  if (inscription.ok) return cookies(inscription);
  const connexion = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify({ email: courriel, password: MOT_DE_PASSE }),
  });
  if (!connexion.ok) {
    throw new Error(`ni inscription ni connexion : HTTP ${connexion.status}`);
  }
  return cookies(connexion);
}

async function club(cookie) {
  const existant = await prisma.organization.findUnique({
    where: { slug: "essai-five" },
    include: { club: true },
  });
  if (existant?.club) return existant.id;
  // Le plugin organization de Better Auth crée l'organisation ET le membre
  // propriétaire ; un hook de lib/auth.ts crée la ligne Club de même
  // identifiant. On ne recopie pas cette mécanique : on l'appelle.
  const res = await fetch(`${BASE}/api/auth/organization/create`, {
    method: "POST",
    headers: { ...entetes, cookie },
    body: JSON.stringify({ name: "Five d'essai", slug: "essai-five" }),
  });
  if (!res.ok) {
    throw new Error(
      `création du club : HTTP ${res.status} ${(await res.text()).slice(0, 200)}`,
    );
  }
  return (await res.json()).id;
}

const NOMS = [
  "Antoine", "Bakary", "Cédric", "Diame", "Enzo", "Farid",
  "Gaël", "Hugo", "Ismaël", "Jean", "Karim", "Lucas",
];

async function main() {
  const cookie = await compte(COURRIEL, "Dev Five");
  // Un second compte, membre d'AUCUN club. Sans lui, on ne peut pas vérifier
  // la seule chose qui compte pour la confidentialité : qu'un utilisateur
  // connecté mais étranger au club reçoive 404 — pas 403, qui confirmerait
  // l'existence du club à qui devine un identifiant.
  await compte(INTRUS, "Intrus");
  // Un troisième compte, membre ORDINAIRE du club et SANS profil joueur.
  // C'est l'état réel du premier soir : quelqu'un rejoint le club, ouvre
  // l'effectif, et doit pouvoir dire « ce joueur, c'est moi ». Le créateur du
  // club ne peut pas jouer ce rôle — le hook de `lib/auth.ts` lui a déjà fait
  // une fiche —, et l'intrus non plus, il n'est membre de rien.
  await compte(MEMBRE, "Membre Simple");
  const clubId = await club(cookie);
  const moi = await prisma.user.findUnique({ where: { email: COURRIEL } });
  const membre = await prisma.user.findUniqueOrThrow({ where: { email: MEMBRE } });
  // La ligne `member` est posée en base, pas par une invitation : on ne veut
  // ni le courriel ni l'acceptation, seulement l'état d'arrivée. Et surtout
  // AUCUN joueur ne lui est créé — c'est tout le sujet.
  const dejaMembre = await prisma.member.findFirst({
    where: { organizationId: clubId, userId: membre.id },
  });
  if (!dejaMembre) {
    await prisma.member.create({
      data: {
        id: "membre-essai-simple",
        organizationId: clubId,
        userId: membre.id,
        role: "member",
        createdAt: new Date(),
      },
    });
  }
  // Il repart sans profil à chaque exécution : le parcours en revendique un,
  // et sans ce déliement la seconde exécution trouverait « j'ai déjà un
  // profil » — donc plus aucun bouton « C'est moi » à éprouver.
  await prisma.player.updateMany({
    where: { clubId, userId: membre.id },
    data: { userId: null },
  });

  await prisma.club.update({
    where: { id: clubId },
    data: { membersCanScore: true, motmMode: "VOTE" },
  });

  const saison = await prisma.season.upsert({
    where: { id: "saison-essai" },
    create: {
      id: "saison-essai",
      clubId,
      name: "Saison d'essai",
      startsAt: new Date("2026-09-01"),
      isActive: true,
    },
    update: {},
  });

  // Le créateur du club a DÉJÀ son profil joueur, créé par le hook
  // `afterCreateOrganization` de lib/auth.ts. Le lui recréer viole
  // `@@unique([clubId, userId])` — c'est le premier mur qu'on a rencontré ici,
  // et c'est une bonne nouvelle : la règle « un compte, un joueur par club »
  // tient. On le récupère, on ne le refait pas.
  // Les fiches laissées par le parcours d'écriture (`parcours-lecture.mjs`
  // ajoute un joueur pour éprouver le formulaire du vestiaire). Sans ce
  // balayage, chaque exécution en laisse une de plus et les comptes du
  // vestiaire — « 12 joueurs », « un seul Mamadou » — cessent d'être
  // vérifiables. Le jeu d'essai remet la scène en état ; c'est son travail.
  await prisma.player.deleteMany({
    where: { clubId, id: { startsWith: "joueur-essai-neuf" } },
  });

  const joueurs = [
    await prisma.player.findFirstOrThrow({
      where: { clubId, userId: moi.id },
    }),
  ];
  for (const [i, name] of NOMS.slice(1).entries()) {
    joueurs.push(
      await prisma.player.upsert({
        where: { id: `joueur-essai-${i + 1}` },
        create: {
          id: `joueur-essai-${i + 1}`,
          clubId,
          name,
          skill: 3,
          isGk: i + 1 === 6,
          abonne: i + 1 < 8,
        },
        update: {},
      }),
    );
  }
  await prisma.player.update({
    where: { id: joueurs[0].id },
    data: { isGk: true, abonne: true, skill: 3 },
  });
  const A = joueurs.slice(0, 6);
  const B = joueurs.slice(6, 12);

  // Une soirée à venir, avec sa compo préparée : c'est ce que l'endpoint
  // « lineup » doit rendre.
  const soiree = await prisma.matchDay.upsert({
    where: { id: "soiree-essai" },
    create: {
      id: "soiree-essai",
      clubId,
      seasonId: saison.id,
      date: new Date(Date.now() + 4 * 86400_000),
      title: "Lundi d'essai",
      location: "Gymnase",
      teamAName: "Blanc",
      teamBName: "Noir",
    },
    update: {},
  });
  await prisma.matchDayLineup.deleteMany({ where: { matchDayId: soiree.id } });
  await prisma.matchDayLineup.createMany({
    data: [
      ...A.map((p, i) => ({
        matchDayId: soiree.id,
        playerId: p.id,
        team: "A",
        isGk: i === 0,
      })),
      ...B.map((p, i) => ({
        matchDayId: soiree.id,
        playerId: p.id,
        team: "B",
        isGk: i === 0,
      })),
    ],
  });
  await prisma.rsvp.deleteMany({ where: { matchDayId: soiree.id } });
  await prisma.rsvp.createMany({
    data: joueurs.slice(0, 9).map((p, i) => ({
      matchDayId: soiree.id,
      playerId: p.id,
      status: i < 8 ? "IN" : "MAYBE",
    })),
  });

  // Un match terminé (avec buts, cartons, MVP, votes) et un match en direct :
  // l'app pose deux questions différentes à ces deux-là.
  for (const [id, statut, quand] of [
    ["match-essai-fini", "FINISHED", new Date(Date.now() - 7 * 86400_000)],
    ["match-essai-live", "LIVE", new Date()],
  ]) {
    await prisma.match.upsert({
      where: { id },
      create: {
        id,
        clubId,
        seasonId: saison.id,
        matchDayId: statut === "FINISHED" ? null : soiree.id,
        status: statut,
        playedAt: quand,
        teamAName: "Blanc",
        teamBName: "Noir",
        durationMin: statut === "FINISHED" ? 12 : null,
      },
      update: { status: statut },
    });
    await prisma.matchParticipant.deleteMany({ where: { matchId: id } });
    await prisma.matchParticipant.createMany({
      data: [
        ...A.map((p, i) => ({
          matchId: id,
          playerId: p.id,
          team: "A",
          initialTeam: "A",
          isGk: i === 0,
        })),
        ...B.map((p, i) => ({
          matchId: id,
          playerId: p.id,
          team: "B",
          initialTeam: "B",
          isGk: i === 0,
        })),
      ],
    });
  }

  // Un joueur qui change de camp en cours de match : c'est LE cas qui distingue
  // `team` de `initialTeam`, et la feuille doit rendre les deux.
  await prisma.matchParticipant.update({
    where: {
      matchId_playerId: { matchId: "match-essai-fini", playerId: A[5].id },
    },
    data: { team: "B" },
  });

  await prisma.matchEvent.deleteMany({ where: { matchId: "match-essai-fini" } });
  const buts = [
    { type: "GOAL", team: "A", playerId: A[1].id, assistPlayerId: A[2].id, minute: 3 },
    { type: "GOAL", team: "B", playerId: B[1].id, assistPlayerId: null, minute: 5 },
    { type: "OWN_GOAL", team: "A", playerId: B[2].id, assistPlayerId: null, minute: 8 },
    { type: "YELLOW_CARD", team: "B", playerId: B[3].id, assistPlayerId: null, minute: 9 },
    { type: "HALF_TIME", team: "A", playerId: null, assistPlayerId: null, minute: 6 },
  ];
  for (const [i, e] of buts.entries()) {
    await prisma.matchEvent.create({
      data: {
        id: `evt-essai-${i}`,
        matchId: "match-essai-fini",
        ...e,
        // L'ordre de SAISIE, pas celui des minutes : la mi-temps est tapée en
        // dernier avec une minute antérieure, exprès.
        createdAt: new Date(Date.now() - 7 * 86400_000 + i * 60_000),
      },
    });
  }
  await prisma.match.update({
    where: { id: "match-essai-fini" },
    data: { scoreA: 2, scoreB: 1, mvpId: A[1].id },
  });

  await prisma.motmVote.deleteMany({ where: { matchId: "match-essai-fini" } });
  await prisma.motmVote.create({
    data: {
      id: "vote-essai-0",
      matchId: "match-essai-fini",
      voterId: moi.id,
      playerId: A[1].id,
    },
  });

  console.log(
    JSON.stringify(
      {
        clubId,
        soireeId: soiree.id,
        intrus: INTRUS,
        membre: MEMBRE,
        matchFini: "match-essai-fini",
        matchLive: "match-essai-live",
        joueurs: joueurs.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
