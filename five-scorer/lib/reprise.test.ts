// « Compo précédente » (lib/compo.ts, reprendreCompo) contre une vraie base :
// la route de l'app et l'action du site doivent reprendre la MÊME compo.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./prisma";
import { reprendreCompo } from "./compo";

const ORG_ID = `test-reprise-${Date.now()}`;
const jour = (n: number) => new Date(Date.now() + n * 86400_000);

beforeAll(async () => {
  await prisma.organization.create({
    data: { id: ORG_ID, name: "Club de test — reprise.test.ts", slug: ORG_ID, createdAt: new Date() },
  });
  await prisma.club.create({ data: { id: ORG_ID } });
});

afterAll(async () => {
  await prisma.organization.delete({ where: { id: ORG_ID } }).catch(() => {});
});

describe("reprendreCompo", () => {
  it("reprend la dernière soirée préparée AVANT celle-ci, sans les archivés", async () => {
    const [a, b, parti, ancien] = await Promise.all(
      ["Antoine", "Bakary", "Parti depuis", "D'il y a longtemps"].map((name) =>
        prisma.player.create({ data: { clubId: ORG_ID, name } }),
      ),
    );
    await prisma.player.update({ where: { id: parti.id }, data: { isArchived: true } });

    const tresVieille = await prisma.matchDay.create({
      data: { clubId: ORG_ID, date: jour(-14), teamAName: "Vieux A", teamBName: "Vieux B" },
    });
    await prisma.matchDayLineup.create({
      data: { matchDayId: tresVieille.id, playerId: ancien.id, team: "A" },
    });
    const precedente = await prisma.matchDay.create({
      data: { clubId: ORG_ID, date: jour(-7), teamAName: "Blanc", teamBName: "Noir" },
    });
    await prisma.matchDayLineup.createMany({
      data: [
        { matchDayId: precedente.id, playerId: a.id, team: "A", isGk: true },
        { matchDayId: precedente.id, playerId: b.id, team: "B" },
        { matchDayId: precedente.id, playerId: parti.id, team: "B" },
      ],
    });
    // Une soirée préparée APRÈS n'est pas « précédente ».
    const plusTard = await prisma.matchDay.create({ data: { clubId: ORG_ID, date: jour(7) } });
    await prisma.matchDayLineup.create({
      data: { matchDayId: plusTard.id, playerId: ancien.id, team: "B" },
    });

    const cible = await prisma.matchDay.create({ data: { clubId: ORG_ID, date: jour(0) } });
    expect(await reprendreCompo(ORG_ID, cible.id)).toEqual({ ok: true, reprises: 2 });

    const relue = await prisma.matchDay.findUniqueOrThrow({
      where: { id: cible.id },
      include: { lineup: true },
    });
    expect(relue.teamAName).toBe("Blanc");
    expect(relue.teamBName).toBe("Noir");
    expect(
      relue.lineup.map((l) => [l.playerId, l.team, l.isGk]).sort(),
    ).toEqual([[a.id, "A", true], [b.id, "B", false]].sort());
  });

  it("refuse une soirée annulée, et ne reprend pas un lundi annulé", async () => {
    const club = `${ORG_ID}-annul`;
    await prisma.organization.create({
      data: { id: club, name: "Club annulé", slug: club, createdAt: new Date() },
    });
    await prisma.club.create({ data: { id: club } });
    try {
      const joueur = await prisma.player.create({ data: { clubId: club, name: "Antoine" } });
      const vraie = await prisma.matchDay.create({
        data: { clubId: club, date: jour(-14), teamAName: "Blanc", teamBName: "Noir" },
      });
      await prisma.matchDayLineup.create({
        data: { matchDayId: vraie.id, playerId: joueur.id, team: "A" },
      });
      // Une soirée annulée A une compo (préparée avant l'annulation) : elle
      // ne doit pas servir de « précédente ».
      const annulee = await prisma.matchDay.create({
        data: { clubId: club, date: jour(-7), teamAName: "Jaune", teamBName: "Vert", canceledAt: new Date() },
      });
      await prisma.matchDayLineup.create({
        data: { matchDayId: annulee.id, playerId: joueur.id, team: "B" },
      });

      // Écrire SUR une soirée annulée : le même refus que `ecrireCompo`.
      expect(await reprendreCompo(club, annulee.id)).toEqual({
        ok: false,
        status: 409,
        error: "Cette soirée est annulée.",
      });

      const cible = await prisma.matchDay.create({ data: { clubId: club, date: jour(0) } });
      expect(await reprendreCompo(club, cible.id)).toEqual({ ok: true, reprises: 1 });
      const relue = await prisma.matchDay.findUniqueOrThrow({
        where: { id: cible.id },
        include: { lineup: true },
      });
      expect(relue.teamAName).toBe("Blanc");
      expect(relue.lineup.map((l) => l.team)).toEqual(["A"]);
    } finally {
      await prisma.organization.delete({ where: { id: club } }).catch(() => {});
    }
  });

  it("dit qu'il n'y a rien à reprendre, plutôt que d'effacer la compo", async () => {
    const autreClub = `${ORG_ID}-vide`;
    await prisma.organization.create({
      data: { id: autreClub, name: "Club vide", slug: autreClub, createdAt: new Date() },
    });
    await prisma.club.create({ data: { id: autreClub } });
    try {
      const seule = await prisma.matchDay.create({ data: { clubId: autreClub, date: jour(1) } });
      expect(await reprendreCompo(autreClub, seule.id)).toEqual({
        ok: false,
        status: 409,
        error: "Aucune compo précédente à reprendre.",
      });
      // La soirée d'un autre club est introuvable.
      expect(await reprendreCompo(ORG_ID, seule.id)).toMatchObject({ ok: false, status: 404 });
      expect(await reprendreCompo(autreClub, { in: [seule.id] } as unknown as string)).toMatchObject({
        ok: false,
        status: 400,
      });
    } finally {
      await prisma.organization.delete({ where: { id: autreClub } }).catch(() => {});
    }
  });
});
