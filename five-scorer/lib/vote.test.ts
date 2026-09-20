// Le vote de l'homme du match, tel que l'action du site ET la route de l'app
// l'appellent (lib/motm.ts, voterHommeDuMatch). Contre une vraie base, comme
// lib/motm.test.ts : c'est le recompte écrit en base qui compte.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./prisma";
import { voterHommeDuMatch } from "./motm";

const ORG_ID = `test-vote-${Date.now()}`;
const votants: string[] = [];

async function votant(n: number): Promise<string> {
  const id = `${ORG_ID}-votant-${n}`;
  await prisma.user.create({
    data: {
      id,
      name: `Votant ${n}`,
      email: `${id}@five.local`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  votants.push(id);
  return id;
}

async function matchAvec(noms: string[], data: { status?: "FINISHED" | "LIVE"; motmLocked?: boolean } = {}) {
  const joueurs = [];
  for (const name of noms) {
    joueurs.push(await prisma.player.create({ data: { clubId: ORG_ID, name } }));
  }
  const match = await prisma.match.create({
    data: {
      clubId: ORG_ID,
      status: data.status ?? "FINISHED",
      motmLocked: data.motmLocked ?? false,
      participants: {
        create: joueurs.map((j, i) => ({
          playerId: j.id,
          team: i % 2 === 0 ? "A" : "B",
          initialTeam: i % 2 === 0 ? "A" : "B",
        })),
      },
    },
  });
  return { match, joueurs };
}

beforeAll(async () => {
  await prisma.organization.create({
    data: { id: ORG_ID, name: "Club de test — vote.test.ts", slug: ORG_ID, createdAt: new Date() },
  });
  await prisma.club.create({ data: { id: ORG_ID } });
});

afterAll(async () => {
  await prisma.organization.delete({ where: { id: ORG_ID } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: votants } } }).catch(() => {});
});

describe("voterHommeDuMatch", () => {
  it("la pluralité l'emporte, et l'égalité se départage par ordre alphabétique", async () => {
    const { match, joueurs } = await matchAvec(["Zoé", "Bakary", "Karim"]);
    const [zoe, bakary] = joueurs;
    const [v1, v2, v3] = [await votant(1), await votant(2), await votant(3)];
    const vote = (votantId: string, playerId: string) =>
      voterHommeDuMatch({ clubId: ORG_ID, motmMode: "VOTE", votantId, matchId: match.id, playerId });

    expect(await vote(v1, zoe.id)).toEqual({ ok: true, mvpId: zoe.id });
    // Une voix chacun : Bakary passe devant Zoé à l'alphabet.
    expect(await vote(v2, bakary.id)).toEqual({ ok: true, mvpId: bakary.id });
    // Deux voix pour Zoé : la pluralité l'emporte sur l'alphabet.
    expect(await vote(v3, zoe.id)).toEqual({ ok: true, mvpId: zoe.id });
    // Changer d'avis déplace la voix, n'en ajoute pas une.
    expect(await vote(v1, bakary.id)).toEqual({ ok: true, mvpId: bakary.id });
    expect(await prisma.motmVote.count({ where: { matchId: match.id } })).toBe(3);
    expect((await prisma.match.findUnique({ where: { id: match.id } }))?.mvpId).toBe(bakary.id);
  });

  it("refuse, et le dit, tout ce que le site refuse", async () => {
    const v = await votant(4);
    const { match: verrouille, joueurs: [a] } = await matchAvec(["Capitaine"], { motmLocked: true });
    const { match: enCours, joueurs: [b] } = await matchAvec(["En cours"], { status: "LIVE" });
    const { match: fini } = await matchAvec(["Sur la feuille"]);
    const absent = await prisma.player.create({ data: { clubId: ORG_ID, name: "Absent" } });
    const appel = (matchId: string, playerId: unknown, motmMode = "VOTE") =>
      voterHommeDuMatch({ clubId: ORG_ID, motmMode, votantId: v, matchId, playerId: playerId as string });

    expect(await appel(fini.id, absent.id, "ADMIN")).toMatchObject({ ok: false, status: 409 });
    expect(await appel(verrouille.id, a.id)).toMatchObject({
      ok: false,
      status: 409,
      error: "L'homme du match a été désigné par le capitaine ; le vote est fermé.",
    });
    expect(await appel(enCours.id, b.id)).toMatchObject({ ok: false, status: 409 });
    expect(await appel(fini.id, absent.id)).toMatchObject({ ok: false, status: 400 });
    expect(await appel("match-qui-nexiste-pas", absent.id)).toMatchObject({ ok: false, status: 404 });
    expect(await appel(fini.id, { in: [absent.id] })).toMatchObject({ ok: false, status: 400 });
    // Aucun de ces refus n'a laissé de voix derrière lui.
    expect(await prisma.motmVote.count({ where: { voterId: v } })).toBe(0);
  });
});
