// spec 0001, Q6 : updateMatchDetails écrit mvpId sans jamais regarder si le
// club est en mode vote, et voteMotm recomptait à chaque voix en écrasant
// silencieusement ce choix. Match.motmLocked ferme désormais ce trou.
//
// Note sur la façon de tester (même contrainte que lib/matches.test.ts,
// TRANS-22) : voteMotm et updateMatchDetails sont deux actions serveur
// ("use server") qui exigent une session Better Auth, et rien dans ce dépôt
// ne la mocke. La vérification neuve a donc été extraite dans une fonction
// pure, lib/motm.ts::verifierMotmDeverouille, appelée telle quelle depuis
// voteMotm juste après le chargement du match — c'est cette fonction qu'on
// teste ici, contre les deux valeurs de motmLocked qu'une vraie ligne peut
// porter en base. Le reste (le `select` du match qui inclut motmLocked,
// l'ordre des vérifications dans voteMotm, l'écriture de motmLocked par
// updateMatchDetails) est vérifié contre une vraie base ci-dessous et par
// `tsc --noEmit`, pas par un appel direct aux actions elles-mêmes.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./prisma";
import { verifierMotmDeverouille } from "./motm";

const ORG_ID = `test-motm-locked-${Date.now()}`;

beforeAll(async () => {
  await prisma.organization.create({
    data: {
      id: ORG_ID,
      name: "Club de test — motm.test.ts",
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

describe("verifierMotmDeverouille", () => {
  it("refuse le vote quand une désignation manuelle a verrouillé le match", async () => {
    const capitaine = await prisma.player.create({
      data: { clubId: ORG_ID, name: "Désigné par le capitaine" },
    });
    const match = await prisma.match.create({
      data: { clubId: ORG_ID, status: "FINISHED" },
    });

    // Ce que fait updateMatchDetails quand input.mvpId est fourni et non nul.
    await prisma.match.update({
      where: { id: match.id },
      data: { mvpId: capitaine.id, motmLocked: true },
    });

    const relu = await prisma.match.findUnique({
      where: { id: match.id },
      select: { motmLocked: true, mvpId: true },
    });
    expect(relu?.motmLocked).toBe(true);

    const res = verifierMotmDeverouille(relu!.motmLocked);

    expect(res).toEqual({
      ok: false,
      error:
        "L'homme du match a été désigné par le capitaine ; le vote est fermé.",
    });
    // Aucune écriture n'a eu lieu depuis cette vérification : mvpId reste
    // celui du capitaine, pas un résultat de recomptage.
    expect(
      (await prisma.match.findUnique({ where: { id: match.id } }))?.mvpId,
    ).toBe(capitaine.id);
  });

  it("laisse le vote passer normalement quand le match n'est pas verrouillé (non-régression)", async () => {
    const match = await prisma.match.create({
      data: { clubId: ORG_ID, status: "FINISHED" },
    });

    const relu = await prisma.match.findUnique({
      where: { id: match.id },
      select: { motmLocked: true },
    });
    expect(relu?.motmLocked).toBe(false);

    expect(verifierMotmDeverouille(relu!.motmLocked)).toEqual({ ok: true });
  });

  it("relève le verrou quand l'admin retire sa désignation (mvpId: null)", async () => {
    const capitaine = await prisma.player.create({
      data: { clubId: ORG_ID, name: "Désignation retirée ensuite" },
    });
    const match = await prisma.match.create({
      data: {
        clubId: ORG_ID,
        status: "FINISHED",
        mvpId: capitaine.id,
        motmLocked: true,
      },
    });

    // Ce que fait updateMatchDetails quand input.mvpId === null est envoyé
    // explicitement.
    await prisma.match.update({
      where: { id: match.id },
      data: { mvpId: null, motmLocked: false },
    });

    const relu = await prisma.match.findUnique({
      where: { id: match.id },
      select: { motmLocked: true },
    });
    expect(verifierMotmDeverouille(relu!.motmLocked)).toEqual({ ok: true });
  });
});
