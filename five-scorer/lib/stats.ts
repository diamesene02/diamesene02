import { prisma } from "@/lib/prisma";

export type ScorerRow = {
  playerId: string;
  name: string;
  isGuest: boolean;
  goals: number;
};

export async function getTopScorers(limit = 50): Promise<ScorerRow[]> {
  const groups = await prisma.goal.groupBy({
    by: ["scorerId"],
    _count: { _all: true },
    orderBy: { _count: { scorerId: "desc" } },
    take: limit,
  });
  if (groups.length === 0) return [];
  const players = await prisma.player.findMany({
    where: { id: { in: groups.map((g) => g.scorerId) } },
  });
  const byId = new Map(players.map((p) => [p.id, p]));
  return groups
    .map((g) => {
      const p = byId.get(g.scorerId);
      if (!p) return null;
      return {
        playerId: p.id,
        name: p.name,
        isGuest: p.isGuest,
        goals: g._count._all,
      } satisfies ScorerRow;
    })
    .filter((x): x is ScorerRow => x !== null);
}

export type PlayerStats = {
  player: { id: string; name: string; isGuest: boolean };
  matchesPlayed: number;
  goals: number;
  wins: number;
  draws: number;
  losses: number;
  mvpCount: number;
};

export async function getPlayerStats(
  playerId: string
): Promise<PlayerStats | null> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return null;

  const [matchesPlayed, goals, mvpCount, appearances] = await Promise.all([
    prisma.matchPlayer.count({ where: { playerId } }),
    prisma.goal.count({ where: { scorerId: playerId } }),
    prisma.match.count({ where: { mvpId: playerId, status: "FINISHED" } }),
    prisma.matchPlayer.findMany({
      where: { playerId },
      include: {
        match: {
          select: { scoreA: true, scoreB: true, status: true },
        },
      },
    }),
  ]);

  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const ap of appearances) {
    if (ap.match.status !== "FINISHED") continue;
    const diff = ap.match.scoreA - ap.match.scoreB;
    const onA = ap.team === "A";
    if (diff === 0) draws++;
    else if ((diff > 0 && onA) || (diff < 0 && !onA)) wins++;
    else losses++;
  }

  return {
    player: { id: player.id, name: player.name, isGuest: player.isGuest },
    matchesPlayed,
    goals,
    wins,
    draws,
    losses,
    mvpCount,
  };
}
