// Le contenu décide, pas le statut (spec 0006) : un match sans rien à
// perdre s'efface pour de vrai, dès qu'il y a quelque chose il s'annule.
//
// Contre une vraie base, comme le veut ce dépôt — pas de mock Prisma.
// DATABASE_URL doit pointer sur le Postgres local (vérifié avant d'écrire
// ce fichier).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./prisma";
import {
  annulerOuSupprimerMatch,
  joueursValidesPourEvenement,
  joueurSurLaFeuille,
  matchDayAppartientAuClub,
  nomEquipeTronque,
  NOM_EQUIPE_MAX,
  rattrapable,
  retablirMatch,
  SIX_SEMAINES_MS,
  soireeDuJour,
  orphelinsParJour,
  soireeReclame,
} from "./matches";
import { estIdOuVide } from "./ids";

const ORG_ID = `test-annuler-${Date.now()}`;

beforeAll(async () => {
  await prisma.organization.create({
    data: {
      id: ORG_ID,
      name: "Club de test — matches.test.ts",
      slug: ORG_ID,
      createdAt: new Date(),
    },
  });
  await prisma.club.create({ data: { id: ORG_ID } });
});

afterAll(async () => {
  // onDelete: Cascade sur Match.club retire aussi les matchs restants.
  await prisma.organization.delete({ where: { id: ORG_ID } }).catch(() => {});
});

describe("annulerOuSupprimerMatch", () => {
  it("supprime pour de vrai un match sans rien à perdre", async () => {
    const match = await prisma.match.create({
      data: { clubId: ORG_ID, status: "FINISHED" },
    });

    const res = await annulerOuSupprimerMatch(ORG_ID, match.id);

    expect(res).toEqual({ ok: true, geste: "supprime" });
    expect(
      await prisma.match.findUnique({ where: { id: match.id } }),
    ).toBeNull();
  });

  it("annule (et ne supprime pas) un match qui a un but", async () => {
    const match = await prisma.match.create({
      data: { clubId: ORG_ID, status: "FINISHED" },
    });
    await prisma.matchEvent.create({
      data: { matchId: match.id, type: "GOAL", team: "A" },
    });

    const res = await annulerOuSupprimerMatch(ORG_ID, match.id, "Doublon");

    expect(res).toEqual({ ok: true, geste: "annule" });
    const relu = await prisma.match.findUnique({ where: { id: match.id } });
    expect(relu).not.toBeNull();
    expect(relu?.status).toBe("CANCELED");
    expect(relu?.cancelReason).toBe("Doublon");
    expect(relu?.canceledAt).not.toBeNull();
  });

  it("annule aussi un match sans but mais avec une réponse de convocation", async () => {
    const joueur = await prisma.player.create({
      data: { clubId: ORG_ID, name: "Joueur de test" },
    });
    const match = await prisma.match.create({
      data: { clubId: ORG_ID, status: "SCHEDULED" },
    });
    await prisma.rsvp.create({
      data: { matchId: match.id, playerId: joueur.id, status: "IN" },
    });

    const res = await annulerOuSupprimerMatch(ORG_ID, match.id);

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.geste).toBe("annule");
  });

  it("refuse un match introuvable", async () => {
    const res = await annulerOuSupprimerMatch(ORG_ID, "id-inexistant");
    expect(res).toEqual({ ok: false, error: "Match introuvable." });
  });

  it("ne touche pas à un match d'un autre club", async () => {
    const autreOrg = `${ORG_ID}-autre`;
    await prisma.organization.create({
      data: { id: autreOrg, name: "Autre club", slug: autreOrg, createdAt: new Date() },
    });
    await prisma.club.create({ data: { id: autreOrg } });
    const match = await prisma.match.create({
      data: { clubId: autreOrg, status: "FINISHED" },
    });

    const res = await annulerOuSupprimerMatch(ORG_ID, match.id);

    expect(res).toEqual({ ok: false, error: "Match introuvable." });
    expect(await prisma.match.findUnique({ where: { id: match.id } })).not.toBeNull();
    await prisma.organization.delete({ where: { id: autreOrg } });
  });
});

// spec 0001, Q8 + critère d'acceptation « un match annulé peut être
// rétabli, et revient dans les stats » : `retablirMatch` est le symétrique
// d'`annulerOuSupprimerMatch` ci-dessus. `lib/stats.ts` (loadFinishedMatches)
// ne lit QUE les matchs status:"FINISHED" — vérifié par lecture de code, pas
// modifié ici : un retour à FINISHED suffit donc à remettre un match dans
// tous les chiffres, sans le moindre recalcul à écrire.
describe("retablirMatch", () => {
  it("rétablit un match CANCELED en FINISHED et efface canceledAt/cancelReason", async () => {
    const match = await prisma.match.create({
      data: {
        clubId: ORG_ID,
        status: "CANCELED",
        canceledAt: new Date(),
        cancelReason: "Terrain fermé",
      },
    });

    const res = await retablirMatch(ORG_ID, match.id);

    expect(res).toEqual({ ok: true });
    const relu = await prisma.match.findUnique({ where: { id: match.id } });
    expect(relu?.status).toBe("FINISHED");
    expect(relu?.canceledAt).toBeNull();
    expect(relu?.cancelReason).toBeNull();
  });

  it("refuse un match FINISHED (pas annulé), sans rien changer", async () => {
    const match = await prisma.match.create({
      data: { clubId: ORG_ID, status: "FINISHED" },
    });

    const res = await retablirMatch(ORG_ID, match.id);

    expect(res).toEqual({ ok: false, error: "Ce match n'est pas annulé." });
    const relu = await prisma.match.findUnique({ where: { id: match.id } });
    expect(relu?.status).toBe("FINISHED");
  });

  it("refuse un match LIVE (pas annulé), sans rien changer", async () => {
    const match = await prisma.match.create({
      data: { clubId: ORG_ID, status: "LIVE" },
    });

    const res = await retablirMatch(ORG_ID, match.id);

    expect(res).toEqual({ ok: false, error: "Ce match n'est pas annulé." });
    const relu = await prisma.match.findUnique({ where: { id: match.id } });
    expect(relu?.status).toBe("LIVE");
  });

  it("refuse un match introuvable", async () => {
    const res = await retablirMatch(ORG_ID, "id-inexistant");
    expect(res).toEqual({ ok: false, error: "Match introuvable." });
  });

  it("ne touche pas à un match d'un autre club", async () => {
    const autreOrg = `${ORG_ID}-retablir-autre`;
    await prisma.organization.create({
      data: { id: autreOrg, name: "Autre club", slug: autreOrg, createdAt: new Date() },
    });
    await prisma.club.create({ data: { id: autreOrg } });
    const match = await prisma.match.create({
      data: { clubId: autreOrg, status: "CANCELED", canceledAt: new Date() },
    });

    const res = await retablirMatch(ORG_ID, match.id);

    expect(res).toEqual({ ok: false, error: "Match introuvable." });
    const relu = await prisma.match.findUnique({ where: { id: match.id } });
    expect(relu?.status).toBe("CANCELED");
    await prisma.organization.delete({ where: { id: autreOrg } });
  });

  // Non-régression bout-en-bout : annuler un match avec un but, le
  // rétablir, et vérifier qu'il redevient FINISHED sans qu'aucun recalcul ne
  // soit nécessaire — `getLeaderboard`/`loadFinishedMatches` (lib/stats.ts)
  // filtrent déjà `status: "FINISHED"`, un match qui a ce statut et une
  // compo/un événement est donc automatiquement compté, qu'il ait ou non
  // transité par CANCELED entre-temps.
  it("annulerOuSupprimerMatch puis retablirMatch : le match redevient FINISHED, prêt pour les stats", async () => {
    const joueur = await prisma.player.create({
      data: { clubId: ORG_ID, name: "But avant annulation" },
    });
    const match = await prisma.match.create({
      data: {
        clubId: ORG_ID,
        kind: "INTERNAL",
        status: "FINISHED",
        scoreA: 1,
        scoreB: 0,
      },
    });
    await prisma.matchParticipant.create({
      data: {
        matchId: match.id,
        playerId: joueur.id,
        team: "A",
        initialTeam: "A",
      },
    });
    await prisma.matchEvent.create({
      data: {
        matchId: match.id,
        type: "GOAL",
        team: "A",
        playerId: joueur.id,
      },
    });

    const annule = await annulerOuSupprimerMatch(ORG_ID, match.id, "Erreur de saisie");
    expect(annule).toEqual({ ok: true, geste: "annule" });
    const apresAnnulation = await prisma.match.findUnique({ where: { id: match.id } });
    expect(apresAnnulation?.status).toBe("CANCELED");

    const retabli = await retablirMatch(ORG_ID, match.id);
    expect(retabli).toEqual({ ok: true });

    const apresRetablissement = await prisma.match.findUnique({
      where: { id: match.id },
    });
    expect(apresRetablissement?.status).toBe("FINISHED");
    expect(apresRetablissement?.canceledAt).toBeNull();
    expect(apresRetablissement?.cancelReason).toBeNull();
    // Le but et la compo n'ont jamais bougé : rien à recalculer, la
    // fonction n'a fait que reposer le statut et effacer les traces de
    // l'annulation.
    expect(
      await prisma.matchEvent.count({ where: { matchId: match.id, type: "GOAL" } }),
    ).toBe(1);
  });
});

// spec 0001, Q6 : trois portes du serveur écrivaient un identifiant de
// joueur sur un match en vérifiant seulement qu'il appartenait au CLUB,
// jamais qu'il avait vraiment participé à CE match (la feuille, modèle
// MatchParticipant). Les deux fonctions ci-dessous portent cette
// vérification pour les quatre points de contrôle concernés ; ces tests
// l'exercent directement contre une vraie base, comme le reste du fichier.
//
// Note sur la façon de tester : ce dépôt n'a AUCUN précédent de test de
// route API ni d'action serveur ("use server") — vitest.config.ts ne scanne
// que "lib/**/*.test.ts", et les deux actions concernées (POST/PATCH de
// events/route.ts, updateMatchDetails) exigent une session Better Auth que
// rien dans ce dépôt ne mocke. La logique neuve a donc été extraite dans
// lib/matches.ts (joueursValidesPourEvenement, joueurSurLaFeuille), appelée
// telle quelle depuis les quatre points de contrôle ; ce sont ces fonctions
// qu'on teste ici. Le branchement dans les routes/l'action elles-mêmes
// (lecture de match.kind, ordre des vérifications, message renvoyé) reste
// vérifié par relecture de code et par `tsc --noEmit`, pas par un test
// automatisé — comme tout le reste de ces fichiers avant ce changement.
describe("joueursValidesPourEvenement (points 1 et 2 : buteur/passeur/csc)", () => {
  it("refuse un joueur absent du club (non-régression, INTERNAL)", async () => {
    const club2 = `${ORG_ID}-buteur-club2`;
    await prisma.organization.create({
      data: { id: club2, name: "Autre club", slug: club2, createdAt: new Date() },
    });
    await prisma.club.create({ data: { id: club2 } });
    const etranger = await prisma.player.create({
      data: { clubId: club2, name: "Joueur d'un autre club" },
    });
    const match = await prisma.match.create({
      data: { clubId: ORG_ID, kind: "INTERNAL", status: "LIVE" },
    });

    const res = await joueursValidesPourEvenement(
      match.id,
      ORG_ID,
      "INTERNAL",
      [etranger.id],
    );

    expect(res).toEqual({ ok: false, error: "Joueur hors du club" });
    await prisma.organization.delete({ where: { id: club2 } });
  });

  it("refuse un joueur du club mais absent de la feuille de ce match (INTERNAL)", async () => {
    const joueur = await prisma.player.create({
      data: { clubId: ORG_ID, name: "Sur le banc, pas sur la feuille" },
    });
    const match = await prisma.match.create({
      data: { clubId: ORG_ID, kind: "INTERNAL", status: "LIVE" },
    });
    // Le joueur existe dans le club mais n'a pas de MatchParticipant pour CE
    // match : c'est exactement le trou que Q6 documente.

    const res = await joueursValidesPourEvenement(
      match.id,
      ORG_ID,
      "INTERNAL",
      [joueur.id],
    );

    expect(res).toEqual({
      ok: false,
      error: "Joueur hors de la feuille de ce match",
    });
  });

  it("accepte un joueur du club présent sur la feuille de ce match (INTERNAL)", async () => {
    const joueur = await prisma.player.create({
      data: { clubId: ORG_ID, name: "Titulaire" },
    });
    const match = await prisma.match.create({
      data: { clubId: ORG_ID, kind: "INTERNAL", status: "LIVE" },
    });
    await prisma.matchParticipant.create({
      data: {
        matchId: match.id,
        playerId: joueur.id,
        team: "A",
        initialTeam: "A",
      },
    });

    const res = await joueursValidesPourEvenement(
      match.id,
      ORG_ID,
      "INTERNAL",
      [joueur.id],
    );

    expect(res).toEqual({ ok: true });
  });

  it("accepte un joueur du club même absent de la feuille, sur un match EXTERNAL (non-régression)", async () => {
    // La compo n'est pas toujours saisie pour un match amical (kind
    // EXTERNAL) : lib/localMatch.ts n'exige la feuille que pour un INTERNAL,
    // le serveur ne doit pas devenir plus strict que lui.
    const joueur = await prisma.player.create({
      data: { clubId: ORG_ID, name: "But amical sans compo saisie" },
    });
    const match = await prisma.match.create({
      data: { clubId: ORG_ID, kind: "EXTERNAL", status: "LIVE" },
    });

    const res = await joueursValidesPourEvenement(
      match.id,
      ORG_ID,
      "EXTERNAL",
      [joueur.id],
    );

    expect(res).toEqual({ ok: true });
  });
});

describe("joueurSurLaFeuille (points 3 et 4 : homme du match)", () => {
  it("renvoie false pour un joueur du club absent de la feuille de ce match", async () => {
    const joueur = await prisma.player.create({
      data: { clubId: ORG_ID, name: "MVP autoproclamé" },
    });
    const match = await prisma.match.create({
      data: { clubId: ORG_ID, kind: "INTERNAL", status: "FINISHED" },
    });

    expect(await joueurSurLaFeuille(match.id, joueur.id)).toBe(false);
  });

  it("renvoie true pour un joueur présent sur la feuille de ce match", async () => {
    const joueur = await prisma.player.create({
      data: { clubId: ORG_ID, name: "MVP légitime" },
    });
    const match = await prisma.match.create({
      data: { clubId: ORG_ID, kind: "INTERNAL", status: "FINISHED" },
    });
    await prisma.matchParticipant.create({
      data: {
        matchId: match.id,
        playerId: joueur.id,
        team: "A",
        initialTeam: "A",
      },
    });

    expect(await joueurSurLaFeuille(match.id, joueur.id)).toBe(true);
  });

  // Un match EXTERNAL n'a aucune exception pour le MVP (contrairement au
  // but/passe ci-dessus) : la feuille se vérifie dans tous les cas.
  it("renvoie false sur un match EXTERNAL aussi, si le joueur n'est pas sur la feuille", async () => {
    const joueur = await prisma.player.create({
      data: { clubId: ORG_ID, name: "MVP amical hors feuille" },
    });
    const match = await prisma.match.create({
      data: { clubId: ORG_ID, kind: "EXTERNAL", status: "FINISHED" },
    });

    expect(await joueurSurLaFeuille(match.id, joueur.id)).toBe(false);
  });
});

// TRANS-22 : updateMatchDetails (app/actions/matches.ts) valide désormais
// input.mvpId et input.seasonId par estIdOuVide avant tout `where` Prisma,
// exactement comme idsValides(matchId) déjà en tête de fonction. C'est ce
// prédicat qui est testé ici (cf. note plus haut sur l'absence de précédent
// de test d'action serveur dans ce dépôt) : un objet passé à la place d'une
// chaîne — `{ in: [...] }` — doit être rejeté proprement, pas laissé filer
// jusqu'à Prisma où il filtrerait toutes les fiches libres du club d'un coup
// (cf. lib/ids.ts).
describe("TRANS-22 : mvpId/seasonId invalides dans updateMatchDetails", () => {
  it("rejette un objet Prisma passé à la place d'un mvpId", () => {
    expect(estIdOuVide({ in: ["x"] })).toBe(false);
  });

  it("rejette un objet Prisma passé à la place d'un seasonId", () => {
    expect(estIdOuVide({ in: ["x"] })).toBe(false);
  });

  it("accepte toujours un mvpId absent ou nul", () => {
    expect(estIdOuVide(undefined)).toBe(true);
    expect(estIdOuVide(null)).toBe(true);
  });

  it("accepte un identifiant valide", () => {
    expect(estIdOuVide("abcdef123")).toBe(true);
  });
});

// spec 0001, APRES-15/APRES-D3 : `matchDayId` ne s'écrivait qu'à la création
// (scheduleMatch) — jamais à la correction (updateMatchDetails,
// app/actions/matches.ts). Le garde qui rend ce rattachement sûr
// (matchDayAppartientAuClub) est testé directement ici, pour la même raison
// que joueursValidesPourEvenement/joueurSurLaFeuille plus haut : l'action
// serveur elle-même exige une session Better Auth que rien dans ce dépôt ne
// mocke (cf. note en tête de fichier), la logique neuve est donc extraite
// dans lib/matches.ts et c'est elle qu'on éprouve contre une vraie base.
// `updateMatchDetails` renvoie `{ ok: false, error: "Soirée inconnue." }` dès
// que ce garde répond `false` — un refus explicite, jamais une erreur Prisma
// brute (contrainte de clé étrangère ou autre) laissée remonter telle quelle.
describe("matchDayAppartientAuClub (rattacher une soirée après coup)", () => {
  it("accepte une soirée du MÊME club que le match", async () => {
    const matchDay = await prisma.matchDay.create({
      data: { clubId: ORG_ID, date: new Date() },
    });

    expect(await matchDayAppartientAuClub(matchDay.id, ORG_ID)).toBe(true);
  });

  it("refuse une soirée d'un AUTRE club", async () => {
    const autreOrg = `${ORG_ID}-soiree-autre-club`;
    await prisma.organization.create({
      data: { id: autreOrg, name: "Autre club", slug: autreOrg, createdAt: new Date() },
    });
    await prisma.club.create({ data: { id: autreOrg } });
    const matchDayAilleurs = await prisma.matchDay.create({
      data: { clubId: autreOrg, date: new Date() },
    });

    expect(await matchDayAppartientAuClub(matchDayAilleurs.id, ORG_ID)).toBe(
      false,
    );

    await prisma.organization.delete({ where: { id: autreOrg } });
  });

  it("refuse un identifiant de soirée inexistant", async () => {
    expect(
      await matchDayAppartientAuClub("id-de-soiree-inexistant", ORG_ID),
    ).toBe(false);
  });
});

// APRES-21 : `updateMatchDetails` n'appliquait aucune limite de longueur sur
// un nom d'équipe, alors que `scheduleMatch` (app/actions/schedule.ts)
// coupait déjà à 40 caractères à la création. `nomEquipeTronque` pose cette
// limite UNE fois dans lib/matches.ts et c'est la même fonction, appelée à
// l'identique par les deux — la garantie que « les deux se comportent
// pareil » n'est donc plus une coïncidence à surveiller entre deux fichiers,
// c'est la même exécution de code.
describe("nomEquipeTronque (longueur d'un nom d'équipe, APRES-21)", () => {
  it("coupe un nom de plus de 40 caractères à 40, exactement comme scheduleMatch", () => {
    const long = "Les Diables Rouges du Cinquième Arrondissement de Paris";
    expect(long.length).toBeGreaterThan(NOM_EQUIPE_MAX);

    const tronque = nomEquipeTronque(long);

    expect(tronque).toHaveLength(NOM_EQUIPE_MAX);
    expect(tronque).toBe(long.slice(0, NOM_EQUIPE_MAX));
  });

  it("laisse intact un nom de 40 caractères ou moins", () => {
    expect(nomEquipeTronque("Les Bleus")).toBe("Les Bleus");
  });

  it("coupe après avoir retiré les espaces superflus (trim avant slice)", () => {
    expect(nomEquipeTronque("  Les Bleus  ")).toBe("Les Bleus");
  });

  it("renvoie undefined pour un nom vide, blanc, nul ou absent", () => {
    expect(nomEquipeTronque("")).toBeUndefined();
    expect(nomEquipeTronque("   ")).toBeUndefined();
    expect(nomEquipeTronque(null)).toBeUndefined();
    expect(nomEquipeTronque(undefined)).toBeUndefined();
  });
});

describe("rattrapable — la fenêtre de six semaines", () => {
  it("vaut bien six semaines", () => {
    expect(SIX_SEMAINES_MS).toBe(42 * 86400_000);
  });

  it("une soirée d'hier est rattrapable", () => {
    const maintenant = Date.now();
    expect(rattrapable(maintenant - 24 * 3600_000, maintenant)).toBe(true);
  });

  it("une soirée de sept semaines n'est plus rattrapable", () => {
    const maintenant = Date.now();
    expect(rattrapable(maintenant - 49 * 86400_000, maintenant)).toBe(false);
  });

  it("à six semaines pile, plus rattrapable — c'est un « strictement inférieur »", () => {
    const maintenant = Date.now();
    expect(rattrapable(maintenant - SIX_SEMAINES_MS, maintenant)).toBe(false);
  });
});

// La règle du lot 0007 : un match rejoint la soirée de son jour.
//
// Les dates sont écrites en UTC et lues à Paris : un match « du lundi 14 » à
// 18:46 heure du gymnase est 16:46 UTC. C'est volontaire — écrire les cas
// dans le fuseau du serveur serait écrire le bug qu'on répare.
describe("soireeDuJour", () => {
  const LUNDI_19H = new Date("2026-09-14T17:00:00Z"); // 19:00 à Paris
  const LUNDI_1846 = new Date("2026-09-14T16:46:00Z"); // 18:46 à Paris

  it("rend la soirée quand il y en a une ce jour-là", async () => {
    const md = await prisma.matchDay.create({
      data: { clubId: ORG_ID, date: LUNDI_19H },
    });

    expect(await soireeDuJour(prisma, ORG_ID, LUNDI_1846)).toBe(md.id);

    await prisma.matchDay.delete({ where: { id: md.id } });
  });

  it("rend null quand aucune soirée ce jour-là — et c'est une réponse, pas un échec", async () => {
    const md = await prisma.matchDay.create({
      data: { clubId: ORG_ID, date: LUNDI_19H },
    });

    // Le dimanche 13 : on a joué, mais aucune soirée n'existait. Il a raison
    // de rester isolé.
    const dimanche = new Date("2026-09-13T10:30:00Z");
    expect(await soireeDuJour(prisma, ORG_ID, dimanche)).toBeNull();

    await prisma.matchDay.delete({ where: { id: md.id } });
  });

  it("rend null quand DEUX soirées partagent le jour — on ne tranche pas au hasard", async () => {
    const a = await prisma.matchDay.create({
      data: { clubId: ORG_ID, date: LUNDI_19H },
    });
    const b = await prisma.matchDay.create({
      data: { clubId: ORG_ID, date: new Date("2026-09-14T19:00:00Z") },
    });

    expect(await soireeDuJour(prisma, ORG_ID, LUNDI_1846)).toBeNull();

    await prisma.matchDay.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  });

  it("ignore une soirée annulée", async () => {
    const md = await prisma.matchDay.create({
      data: { clubId: ORG_ID, date: LUNDI_19H, canceledAt: new Date() },
    });

    expect(await soireeDuJour(prisma, ORG_ID, LUNDI_1846)).toBeNull();

    await prisma.matchDay.delete({ where: { id: md.id } });
  });

  it("ne traverse pas les clubs", async () => {
    const autre = `${ORG_ID}-voisin`;
    await prisma.organization.create({
      data: { id: autre, name: "Voisin", slug: autre, createdAt: new Date() },
    });
    await prisma.club.create({ data: { id: autre } });
    const md = await prisma.matchDay.create({
      data: { clubId: autre, date: LUNDI_19H },
    });

    expect(await soireeDuJour(prisma, ORG_ID, LUNDI_1846)).toBeNull();
    expect(await soireeDuJour(prisma, autre, LUNDI_1846)).toBe(md.id);

    await prisma.organization.delete({ where: { id: autre } });
  });

  it("le match de 23:30 rejoint son lundi, celui de 00:30 ne le rejoint pas", async () => {
    const md = await prisma.matchDay.create({
      data: { clubId: ORG_ID, date: LUNDI_19H },
    });

    const a2330 = new Date("2026-09-14T21:30:00Z"); // 23:30 à Paris, lundi
    const a0030 = new Date("2026-09-14T22:30:00Z"); // 00:30 à Paris, mardi
    expect(await soireeDuJour(prisma, ORG_ID, a2330)).toBe(md.id);
    expect(await soireeDuJour(prisma, ORG_ID, a0030)).toBeNull();

    await prisma.matchDay.delete({ where: { id: md.id } });
  });

  it("rattache aussi un match de 06:30 — ce que la fenêtre glissante ratait", async () => {
    // 06:30 pour une soirée de 19:00, c'est 12 h 30 d'écart : au-delà des
    // douze heures que le site mesurait. C'est le cas qui prouve que la
    // règle a changé, pas seulement déménagé.
    const md = await prisma.matchDay.create({
      data: { clubId: ORG_ID, date: LUNDI_19H },
    });

    const a0630 = new Date("2026-09-14T04:30:00Z"); // 06:30 à Paris
    expect(Math.abs(LUNDI_19H.getTime() - a0630.getTime())).toBeGreaterThan(
      12 * 3600_000,
    );
    expect(await soireeDuJour(prisma, ORG_ID, a0630)).toBe(md.id);

    await prisma.matchDay.delete({ where: { id: md.id } });
  });
});

// La question que les trois écrans posent — celle qui remplace leurs trois
// versions divergentes. Le piège qu'elle évite : réclamer une feuille pour
// une soirée dont le match existe déjà, ce qui fabriquerait un doublon.
describe("orphelinsParJour et soireeReclame", () => {
  const LUNDI = new Date("2026-09-14T17:00:00Z"); // 19:00 à Paris
  const LARGE = {
    debut: new Date("2026-09-01T00:00:00Z"),
    fin: new Date("2026-10-01T00:00:00Z"),
  };
  const MAINTENANT = new Date("2026-09-17T12:00:00Z").getTime();

  it("trouve un orphelin du bon jour, ignore un match déjà rattaché", async () => {
    const md = await prisma.matchDay.create({
      data: { clubId: ORG_ID, date: LUNDI },
    });
    const orphelin = await prisma.match.create({
      data: {
        clubId: ORG_ID,
        status: "FINISHED",
        playedAt: new Date("2026-09-14T16:46:00Z"),
      },
    });
    const range = await prisma.match.create({
      data: {
        clubId: ORG_ID,
        status: "FINISHED",
        playedAt: new Date("2026-09-14T16:50:00Z"),
        matchDayId: md.id,
      },
    });

    const parJour = await orphelinsParJour(prisma, ORG_ID, LARGE);
    expect(parJour.get("2026-09-14")).toBe(orphelin.id);

    await prisma.match.deleteMany({
      where: { id: { in: [orphelin.id, range.id] } },
    });
    await prisma.matchDay.delete({ where: { id: md.id } });
  });

  it("une soirée qui a déjà un match ne réclame rien — « On rejoue » reste possible", () => {
    const r = soireeReclame(
      { date: LUNDI, canceledAt: null, matchsActifs: 1 },
      new Map([["2026-09-14", "peu-importe"]]),
      MAINTENANT,
    );
    expect(r).toEqual({ quoi: "rien" });
  });

  it("une soirée vide avec un orphelin du jour propose de RATTACHER, pas de saisir", () => {
    const r = soireeReclame(
      { date: LUNDI, canceledAt: null, matchsActifs: 0 },
      new Map([["2026-09-14", "m-17-11"]]),
      MAINTENANT,
    );
    expect(r).toEqual({ quoi: "rattacher", matchId: "m-17-11" });
  });

  it("une soirée vraiment vide propose de saisir — le rattrapage légitime", () => {
    const r = soireeReclame(
      { date: LUNDI, canceledAt: null, matchsActifs: 0 },
      new Map(),
      MAINTENANT,
    );
    expect(r).toEqual({ quoi: "saisir" });
  });

  it("une soirée annulée ne réclame rien", () => {
    const r = soireeReclame(
      { date: LUNDI, canceledAt: new Date(), matchsActifs: 0 },
      new Map(),
      MAINTENANT,
    );
    expect(r).toEqual({ quoi: "rien" });
  });

  it("au-delà de six semaines, on se tait", () => {
    const r = soireeReclame(
      { date: LUNDI, canceledAt: null, matchsActifs: 0 },
      new Map(),
      LUNDI.getTime() + SIX_SEMAINES_MS + 1,
    );
    expect(r).toEqual({ quoi: "rien" });
  });

  it("la fenêtre est la MÊME que celle de la règle : 23:30 est du lundi", async () => {
    // C'est la contrainte que /analyser a nommée. Si les deux fenêtres
    // divergeaient, un match de 23:30 serait rattaché par la règle mais
    // introuvable par la question — la soirée resterait réclamée pour
    // toujours.
    const tard = await prisma.match.create({
      data: {
        clubId: ORG_ID,
        status: "FINISHED",
        playedAt: new Date("2026-09-14T21:30:00Z"), // 23:30 à Paris
      },
    });

    const parJour = await orphelinsParJour(prisma, ORG_ID, LARGE);
    expect(parJour.get("2026-09-14")).toBe(tard.id);
    expect(
      soireeReclame(
        { date: LUNDI, canceledAt: null, matchsActifs: 0 },
        parJour,
        MAINTENANT,
      ),
    ).toEqual({ quoi: "rattacher", matchId: tard.id });

    await prisma.match.delete({ where: { id: tard.id } });
  });
});
