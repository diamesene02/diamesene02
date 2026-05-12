import { prisma } from "@/lib/prisma";

export type ScorerRow = {
  playerId: string;
  name: string;
  isGuest: boolean;
  goals: number;
  matchesPlayed: number;
};

export async function getTopScorers(limit = 50): Promise<ScorerRow[]> {
  // Soft-deleted matches contribute neither goals nor caps to the leaderboard.
  const [goalGroups, mpGroups] = await Promise.all([
    prisma.goal.groupBy({
      by: ["scorerId"],
      where: { match: { deletedAt: null } },
      _count: { _all: true },
    }),
    prisma.matchPlayer.groupBy({
      by: ["playerId"],
      where: { match: { deletedAt: null } },
      _count: { _all: true },
    }),
  ]);

  const stats = new Map<string, { goals: number; mp: number }>();
  goalGroups.forEach((g) => {
    const s = stats.get(g.scorerId) || { goals: 0, mp: 0 };
    s.goals = g._count._all;
    stats.set(g.scorerId, s);
  });
  mpGroups.forEach((m) => {
    const s = stats.get(m.playerId) || { goals: 0, mp: 0 };
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
        matchesPlayed: s.mp,
      } satisfies ScorerRow;
    })
    .filter((x): x is ScorerRow => x !== null)
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export type PlayerStats = {
  player: { id: string; name: string; isGuest: boolean };
  matchesPlayed: number;
  goals: number;
  wins: number;
  draws: number;
  losses: number;
  mvpCount: number;
  /** Current streak — consecutive same-result FINISHED matches counting back from the most recent. */
  streak: { type: "W" | "L" | "D"; count: number } | null;
  recentMatches: { id: string; playedAt: string; score: string; result: "W" | "D" | "L" | "?" }[];
};

export async function getPlayerStats(
  playerId: string
): Promise<PlayerStats | null> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return null;

  // Filter deletedAt: null everywhere so trashed matches don't pollute the
  // player's personal stats.
  const [matchesPlayed, goals, mvpCount, appearances] = await Promise.all([
    prisma.matchPlayer.count({ where: { playerId, match: { deletedAt: null } } }),
    prisma.goal.count({ where: { scorerId: playerId, match: { deletedAt: null } } }),
    prisma.match.count({ where: { mvpId: playerId, status: "FINISHED", deletedAt: null } }),
    prisma.matchPlayer.findMany({
      where: { playerId, match: { deletedAt: null } },
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
  // appearances is ordered desc by playedAt — i.e. most-recent FINISHED
  // match first. The current streak is the run of identical results at
  // the front of that list. `streakLive` flips to false on the first
  // mismatch so we stop growing the count.
  let streak: { type: "W" | "L" | "D"; count: number } | null = null;
  let streakLive = true;
  for (const ap of appearances) {
    if (ap.match.status !== "FINISHED") continue;
    const diff = ap.match.scoreA - ap.match.scoreB;
    const onA = ap.team === "A";
    const result: "W" | "L" | "D" =
      diff === 0 ? "D" : (diff > 0 && onA) || (diff < 0 && !onA) ? "W" : "L";
    if (result === "W") wins++;
    else if (result === "L") losses++;
    else draws++;
    if (streakLive) {
      if (streak === null) streak = { type: result, count: 1 };
      else if (streak.type === result) streak.count++;
      else streakLive = false;
    }
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
    wins,
    draws,
    losses,
    mvpCount,
    streak,
    recentMatches,
  };
}
