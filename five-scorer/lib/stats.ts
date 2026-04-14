import { prisma } from "@/lib/prisma";

export type ScorerRow = {
  playerId: string;
  name: string;
  isGuest: boolean;
  goals: number;
  assists: number;
  matchesPlayed: number;
  ga: number; // goals + assists
};

export async function getTopScorers(limit = 50): Promise<ScorerRow[]> {
  const [goalGroups, assistGroups, mpGroups] = await Promise.all([
    prisma.goal.groupBy({
      by: ["scorerId"],
      _count: { _all: true },
    }),
    prisma.goal.groupBy({
      by: ["assistId"],
      where: { assistId: { not: null } },
      _count: { _all: true },
    }),
    prisma.matchPlayer.groupBy({
      by: ["playerId"],
      _count: { _all: true },
    }),
  ]);

  const stats = new Map<string, { goals: number; assists: number; mp: number }>();
  goalGroups.forEach((g) => {
    const s = stats.get(g.scorerId) || { goals: 0, assists: 0, mp: 0 };
    s.goals = g._count._all;
    stats.set(g.scorerId, s);
  });
  assistGroups.forEach((a) => {
    if (!a.assistId) return;
    const s = stats.get(a.assistId) || { goals: 0, assists: 0, mp: 0 };
    s.assists = a._count._all;
    stats.set(a.assistId, s);
  });
  mpGroups.forEach((m) => {
    const s = stats.get(m.playerId) || { goals: 0, assists: 0, mp: 0 };
    s.mp = m._count._all;
    stats.set(m.playerId, s);
  });

  const ids = Array.from(stats.keys());
  if (ids.length === 0) return [];
  const players = await prisma.player.findMany({ where: { id: { in: ids } } });
  const byId = new Map(players.map((p) => [p.id, p]));

  return ids
    .map((id) => {
      const p = byId.get(id);
      const s = stats.get(id)!;
      if (!p) return null;
      return {
        playerId: p.id,
        name: p.name,
        isGuest: p.isGuest,
        goals: s.goals,
        assists: s.assists,
        matchesPlayed: s.mp,
        ga: s.goals + s.assists,
      } satisfies ScorerRow;
    })
    .filter((x): x is ScorerRow => x !== null)
    .sort((a, b) => b.ga - a.ga || b.goals - a.goals || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export type PlayerStats = {
  player: { id: string; name: string; isGuest: boolean };
  matchesPlayed: number;
  goals: number;
  assists: number;
  wins: number;
  draws: number;
  losses: number;
  mvpCount: number;
  recentMatches: { id: string; playedAt: string; score: string; result: "W" | "D" | "L" | "?" }[];
};

export async function getPlayerStats(
  playerId: string
): Promise<PlayerStats | null> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return null;

  const [matchesPlayed, goals, assists, mvpCount, appearances] = await Promise.all([
    prisma.matchPlayer.count({ where: { playerId } }),
    prisma.goal.count({ where: { scorerId: playerId } }),
    prisma.goal.count({ where: { assistId: playerId } }),
    prisma.match.count({ where: { mvpId: playerId, status: "FINISHED" } }),
    prisma.matchPlayer.findMany({
      where: { playerId },
      include: {
        match: {
          select: { id: true, playedAt: true, scoreA: true, scoreB: true, status: true },
        },
      },
      orderBy: { match: { playedAt: "desc" } },
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

  const recentMatches = appearances.slice(0, 5).map((ap) => {
    const onA = ap.team === "A";
    let result: "W" | "D" | "L" | "?" = "?";
    if (ap.match.status === "FINISHED") {
      const diff = ap.match.scoreA - ap.match.scoreB;
      result = diff === 0 ? "D" : (diff > 0 && onA) || (diff < 0 && !onA) ? "W" : "L";
    }
    return {
      id: ap.match.id,
      playedAt: ap.match.playedAt.toISOString(),
      score: `${ap.match.scoreA}-${ap.match.scoreB}`,
      result,
    };
  });

  return {
    player: { id: player.id, name: player.name, isGuest: player.isGuest },
    matchesPlayed,
    goals,
    assists,
    wins,
    draws,
    losses,
    mvpCount,
    recentMatches,
  };
}
