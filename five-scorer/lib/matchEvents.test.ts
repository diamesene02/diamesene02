// Les écritures partagées d'un match — but, passe, csc, composition — et le
// marqueur de correction qu'elles posent quand le match est déjà clos.
//
// Contre une vraie base, comme le reste de ce dépôt — pas de mock Prisma.
// DATABASE_URL doit pointer sur le Postgres local (vérifié avant d'écrire
// ce fichier). La FK correctedById exige un vrai User : la fixture en crée
// un, et le retire à la fin.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./prisma";
import {
  creerEvenementMatch,
  deplacerJoueurMatch,
  inscrireJoueurMatch,
  modifierEvenementMatch,
  supprimerEvenementMatch,
} from "./matchEvents";

const ORG = `test-corr-${Date.now()}`;
const ADMIN = `${ORG}-admin`;
const J = { j1: "", j2: "", j3: "", j4: "", banc: "" };

beforeAll(async () => {
  await prisma.organization.create({
    data: { id: ORG, name: "Club de test — matchEvents", slug: ORG, createdAt: new Date() },
  });
  await prisma.club.create({ data: { id: ORG } });
  await prisma.user.create({
    data: { id: ADMIN, name: "Capitaine de test", email: `${ORG}@test.local` },
  });
  for (const nom of Object.keys(J) as (keyof typeof J)[]) {
    const p = await prisma.player.create({ data: { clubId: ORG, name: nom } });
    J[nom] = p.id;
  }
});

afterAll(async () => {
  await prisma.organization.delete({ where: { id: ORG } }).catch(() => {});
  await prisma.user.delete({ where: { id: ADMIN } }).catch(() => {});
});

/// Un match interne, j1/j2 chez A, j3/j4 chez B — `banc` est du club mais
/// pas sur la feuille.
async function matchDuSoir(status: "LIVE" | "FINISHED" | "CANCELED", kind: "INTERNAL" | "EXTERNAL" = "INTERNAL") {
  const m = await prisma.match.create({ data: { clubId: ORG, status, kind } });
  await prisma.matchParticipant.createMany({
    data: [
      { matchId: m.id, playerId: J.j1, team: "A", initialTeam: "A" },
      { matchId: m.id, playerId: J.j2, team: "A", initialTeam: "A" },
      { matchId: m.id, playerId: J.j3, team: "B", initialTeam: "B" },
      { matchId: m.id, playerId: J.j4, team: "B", initialTeam: "B" },
    ],
  });
  return m.id;
}

const relire = (id: string) => prisma.match.findUniqueOrThrow({ where: { id } });

const base = (matchId: string, canManage: boolean) => ({
  clubId: ORG,
  matchId,
  canManage,
  userId: ADMIN,
});

describe("creerEvenementMatch", () => {
  it("un but sur un match en cours n'est pas une correction", async () => {
    const id = await matchDuSoir("LIVE");
    const res = await creerEvenementMatch({ ...base(id, false), type: "GOAL", team: "A", playerId: J.j1, minute: 12 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.status).toBe(201);
    const m = await relire(id);
    expect(m.scoreA).toBe(1);
    expect(m.correctedAt).toBeNull();
    expect(m.correctedById).toBeNull();
  });

  it("un membre ne corrige pas un match terminé", async () => {
    const id = await matchDuSoir("FINISHED");
    const res = await creerEvenementMatch({ ...base(id, false), type: "GOAL", team: "A", playerId: J.j1 });
    expect(res).toEqual({ ok: false, status: 403, error: "Admin requis pour modifier un match terminé ou annulé" });
    expect(await prisma.matchEvent.count({ where: { matchId: id } })).toBe(0);
  });

  it("un admin corrige un match terminé — et ça se voit sur le match", async () => {
    const id = await matchDuSoir("FINISHED");
    const avant = Date.now();
    const res = await creerEvenementMatch({ ...base(id, true), type: "GOAL", team: "B", playerId: J.j3, minute: null });
    expect(res.ok).toBe(true);
    const m = await relire(id);
    expect(m.scoreB).toBe(1);
    expect(m.correctedById).toBe(ADMIN);
    expect(m.correctedAt?.getTime()).toBeGreaterThanOrEqual(avant - 1000);
  });

  it("un but rejoué avec le même identifiant est dédupliqué, pas compté deux fois", async () => {
    const id = await matchDuSoir("LIVE");
    const ev = "evt-" + id.slice(-8);
    const un = await creerEvenementMatch({ ...base(id, false), id: ev, type: "GOAL", team: "A", playerId: J.j1 });
    const deux = await creerEvenementMatch({ ...base(id, false), id: ev, type: "GOAL", team: "A", playerId: J.j1 });
    expect(un.ok && un.status).toBe(201);
    expect(deux.ok && deux.deduped).toBe(true);
    expect((await relire(id)).scoreA).toBe(1);
  });

  it("un joueur du club absent de la feuille est refusé sur un match interne", async () => {
    const id = await matchDuSoir("LIVE");
    const res = await creerEvenementMatch({ ...base(id, false), type: "GOAL", team: "A", playerId: J.banc });
    expect(res).toEqual({ ok: false, status: 400, error: "Joueur hors de la feuille de ce match" });
  });
});

describe("supprimerEvenementMatch", () => {
  it("retire un but d'un match terminé, recalcule le score, marque la correction", async () => {
    const id = await matchDuSoir("FINISHED");
    const ev = await prisma.matchEvent.create({ data: { matchId: id, type: "GOAL", team: "A", playerId: J.j1 } });
    await prisma.match.update({ where: { id }, data: { scoreA: 1 } });

    const res = await supprimerEvenementMatch({ ...base(id, true), eventId: ev.id });
    expect(res.ok).toBe(true);
    const m = await relire(id);
    expect(m.scoreA).toBe(0);
    expect(m.correctedById).toBe(ADMIN);
  });

  it("reste idempotent : un événement déjà parti ne fait pas échouer le rejeu", async () => {
    const id = await matchDuSoir("LIVE");
    const res = await supprimerEvenementMatch({ ...base(id, false), eventId: "jamais-existe" });
    expect(res.ok).toBe(true);
  });
});

describe("modifierEvenementMatch", () => {
  it("attache une passe à un but, et marque la correction sur un match terminé", async () => {
    const id = await matchDuSoir("FINISHED");
    const ev = await prisma.matchEvent.create({ data: { matchId: id, type: "GOAL", team: "A", playerId: J.j1 } });
    const res = await modifierEvenementMatch({ ...base(id, true), eventId: ev.id, setsScorer: false, assistPlayerId: J.j2 });
    expect(res).toEqual({ ok: true });
    expect((await prisma.matchEvent.findUniqueOrThrow({ where: { id: ev.id } })).assistPlayerId).toBe(J.j2);
    expect((await relire(id)).correctedById).toBe(ADMIN);
  });

  it("désigne l'auteur d'un contre son camp — et refuse de le faire sur un but normal", async () => {
    const id = await matchDuSoir("LIVE");
    const csc = await prisma.matchEvent.create({ data: { matchId: id, type: "OWN_GOAL", team: "A" } });
    const but = await prisma.matchEvent.create({ data: { matchId: id, type: "GOAL", team: "A", playerId: J.j1 } });
    await modifierEvenementMatch({ ...base(id, false), eventId: csc.id, setsScorer: true, scorerPlayerId: J.j3 });
    await modifierEvenementMatch({ ...base(id, false), eventId: but.id, setsScorer: true, scorerPlayerId: J.j3 });
    expect((await prisma.matchEvent.findUniqueOrThrow({ where: { id: csc.id } })).playerId).toBe(J.j3);
    // Le type est contraint dans le where : le but normal garde son buteur.
    expect((await prisma.matchEvent.findUniqueOrThrow({ where: { id: but.id } })).playerId).toBe(J.j1);
  });
});

describe("deplacerJoueurMatch", () => {
  it("fait changer un joueur de camp sur un match terminé, en le marquant corrigé", async () => {
    const id = await matchDuSoir("FINISHED");
    const res = await deplacerJoueurMatch({ ...base(id, true), playerId: J.j1, team: "B" });
    expect(res).toEqual({ ok: true, applique: true });
    const p = await prisma.matchParticipant.findUniqueOrThrow({ where: { matchId_playerId: { matchId: id, playerId: J.j1 } } });
    expect(p.team).toBe("B");
    expect((await relire(id)).correctedById).toBe(ADMIN);
  });

  it("refuse l'équipe B d'un match contre un adversaire", async () => {
    const id = await matchDuSoir("LIVE", "EXTERNAL");
    const res = await deplacerJoueurMatch({ ...base(id, false), playerId: J.j1, team: "B" });
    expect(res).toEqual({ ok: false, status: 400, error: "Pas d'équipe B à composer sur un match contre un adversaire" });
  });

  it("un joueur hors feuille n'est pas un refus, et ne marque rien", async () => {
    const id = await matchDuSoir("FINISHED");
    const res = await deplacerJoueurMatch({ ...base(id, true), playerId: J.banc, team: "B" });
    expect(res).toEqual({ ok: true, applique: false });
    expect((await relire(id)).correctedById).toBeNull();
  });
});

describe("inscrireJoueurMatch", () => {
  it("inscrit un retardataire une seule fois, même rejoué", async () => {
    const id = await matchDuSoir("LIVE");
    const un = await inscrireJoueurMatch({ ...base(id, false), playerId: J.banc, team: "A" });
    const deux = await inscrireJoueurMatch({ ...base(id, false), playerId: J.banc, team: "B" });
    expect(un).toEqual({ ok: true, applique: true });
    expect(deux).toEqual({ ok: true, applique: false });
    const p = await prisma.matchParticipant.findUniqueOrThrow({ where: { matchId_playerId: { matchId: id, playerId: J.banc } } });
    expect(p.team).toBe("A"); // le rejeu n'a pas réécrit le camp
  });

  it("refuse un joueur d'un autre club", async () => {
    const autre = `${ORG}-autre`;
    await prisma.organization.create({ data: { id: autre, name: "Autre", slug: autre, createdAt: new Date() } });
    await prisma.club.create({ data: { id: autre } });
    const etranger = await prisma.player.create({ data: { clubId: autre, name: "étranger" } });
    const id = await matchDuSoir("LIVE");
    const res = await inscrireJoueurMatch({ ...base(id, false), playerId: etranger.id, team: "A" });
    expect(res).toEqual({ ok: false, status: 400, error: "Joueur hors du club" });
    await prisma.organization.delete({ where: { id: autre } });
  });
});
