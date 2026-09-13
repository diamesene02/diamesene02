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
