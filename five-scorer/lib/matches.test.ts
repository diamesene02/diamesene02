// Le contenu décide, pas le statut (spec 0006) : un match sans rien à
// perdre s'efface pour de vrai, dès qu'il y a quelque chose il s'annule.
//
// Contre une vraie base, comme le veut ce dépôt — pas de mock Prisma.
// DATABASE_URL doit pointer sur le Postgres local (vérifié avant d'écrire
// ce fichier).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./prisma";
import { annulerOuSupprimerMatch } from "./matches";

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
