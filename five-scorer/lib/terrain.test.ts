// La caisse du terrain (lib/terrain.ts), contre une vraie base : ce qui
// compte, c'est ce qui reste écrit — la case cochée, et le rang de chacun
// dans la file, qui ne doit pas bouger quand on paie.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./prisma";
import { ecrirePrixTerrain, marquerPaye, PRIX_TERRAIN_MAX_CENTS } from "./terrain";

const ORG_ID = `test-terrain-${Date.now()}`;
let soireeId = "";

beforeAll(async () => {
  await prisma.organization.create({
    data: { id: ORG_ID, name: "Club de test — terrain.test.ts", slug: ORG_ID, createdAt: new Date() },
  });
  await prisma.club.create({ data: { id: ORG_ID } });
  const soiree = await prisma.matchDay.create({
    data: { clubId: ORG_ID, date: new Date(Date.now() + 3 * 86400_000) },
  });
  soireeId = soiree.id;
});

afterAll(async () => {
  await prisma.organization.delete({ where: { id: ORG_ID } }).catch(() => {});
});

describe("ecrirePrixTerrain", () => {
  it("borne le prix, arrondit au centime, et null retire le suivi", async () => {
    const prix = async () =>
      (await prisma.matchDay.findUnique({ where: { id: soireeId } }))?.fieldCostCents;

    expect(await ecrirePrixTerrain(ORG_ID, soireeId, 6000.4)).toEqual({ ok: true });
    expect(await prix()).toBe(6000);
    await ecrirePrixTerrain(ORG_ID, soireeId, -50);
    expect(await prix()).toBe(0);
    await ecrirePrixTerrain(ORG_ID, soireeId, 1e12);
    expect(await prix()).toBe(PRIX_TERRAIN_MAX_CENTS);
    await ecrirePrixTerrain(ORG_ID, soireeId, null);
    expect(await prix()).toBeNull();

    expect(await ecrirePrixTerrain(ORG_ID, soireeId, Number.NaN)).toMatchObject({ ok: false, status: 400 });
    expect(await ecrirePrixTerrain(ORG_ID, "soiree-qui-nexiste-pas", 100)).toMatchObject({
      ok: false,
      status: 404,
    });
    // La soirée d'un autre club est introuvable, pas modifiable.
    expect(await ecrirePrixTerrain("un-autre-club", soireeId, 100)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("marquerPaye", () => {
  it("coche sans faire reculer le joueur dans la file", async () => {
    const joueur = await prisma.player.create({ data: { clubId: ORG_ID, name: "Répondant" } });
    const tot = new Date(Date.now() - 86400_000);
    await prisma.rsvp.create({
      data: { matchDayId: soireeId, playerId: joueur.id, status: "IN", respondedAt: tot },
    });

    expect(await marquerPaye(ORG_ID, soireeId, joueur.id, true)).toEqual({ ok: true });
    const relu = await prisma.rsvp.findUnique({
      where: { matchDayId_playerId: { matchDayId: soireeId, playerId: joueur.id } },
    });
    expect(relu?.hasPaid).toBe(true);
    expect(relu?.respondedAt.getTime()).toBe(tot.getTime());

    expect(await marquerPaye(ORG_ID, soireeId, joueur.id, false)).toEqual({ ok: true });
  });

  it("un abonné sans réponse peut payer, et garde son rang d'abonné", async () => {
    const abonne = await prisma.player.create({
      data: { clubId: ORG_ID, name: "Abonné", abonne: true },
    });
    const soiree = await prisma.matchDay.findUniqueOrThrow({ where: { id: soireeId } });

    // Décocher quelqu'un qui n'a jamais payé : rien à écrire, et c'est vrai.
    expect(await marquerPaye(ORG_ID, soireeId, abonne.id, false)).toEqual({ ok: true });
    expect(
      await prisma.rsvp.count({ where: { matchDayId: soireeId, playerId: abonne.id } }),
    ).toBe(0);

    expect(await marquerPaye(ORG_ID, soireeId, abonne.id, true)).toEqual({ ok: true });
    const ligne = await prisma.rsvp.findUnique({
      where: { matchDayId_playerId: { matchDayId: soireeId, playerId: abonne.id } },
    });
    expect(ligne?.status).toBe("IN");
    expect(ligne?.hasPaid).toBe(true);
    // Engagé à la naissance de la soirée, comme tout abonné.
    expect(ligne?.respondedAt.getTime()).toBe(soiree.createdAt.getTime());
  });

  it("refuse, et le dit, un joueur qui n'a ni réponse ni abonnement", async () => {
    const muet = await prisma.player.create({ data: { clubId: ORG_ID, name: "Muet" } });
    expect(await marquerPaye(ORG_ID, soireeId, muet.id, true)).toEqual({
      ok: false,
      status: 409,
      error: "Pas de réponse de ce joueur.",
    });
    expect(await marquerPaye(ORG_ID, soireeId, muet.id, "oui" as unknown as boolean)).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(await marquerPaye(ORG_ID, "soiree-qui-nexiste-pas", muet.id, true)).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(
      await marquerPaye(ORG_ID, soireeId, { in: [muet.id] } as unknown as string, true),
    ).toMatchObject({ ok: false, status: 400 });
  });
});
