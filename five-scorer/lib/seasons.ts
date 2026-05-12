// Virtual seasons computed from match.playedAt. We group matches by
// calendar month (e.g. "Mai 2026") — no DB schema change required.
//
// For each season we compute:
//   - top scorer (most goals across the season's FINISHED matches)
//   - MVP leader (most match MVPs)
//   - best win ratio (min 3 played to qualify)

import { prisma } from "@/lib/prisma";

export type SeasonWinner = {
  playerId: string;
  name: string;
  value: number;
  /** Secondary label e.g. "8 matchs" for win ratio, undefined for goals/MVP */
  detail?: string;
};

export type SeasonSummary = {
  /** "YYYY-MM" — sortable key */
  id: string;
  /** Human label e.g. "Mai 2026" */
  label: string;
  /** Number of FINISHED matches in this period */
  matchCount: number;
  topScorer: SeasonWinner | null;
  topMvp: SeasonWinner | null;
  bestRatio: SeasonWinner | null;
};

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function seasonIdFor(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function seasonLabelFor(id: string): string {
  const [year, month] = id.split("-").map((n) => parseInt(n, 10));
  return `${MONTHS_FR[month - 1]} ${year}`;
}

export async function getSeasons(): Promise<SeasonSummary[]> {
  // Pull everything in a single round-trip. Five is hobby-scale so the
  // dataset is tiny (a few hundred matches max).
  const matches = await prisma.match.findMany({
    where: { status: "FINISHED" },
    include: {
      mvp: { select: { id: true, name: true } },
      players: { include: { player: { select: { id: true, name: true } } } },
      goals: { select: { scorerId: true } },
    },
    orderBy: { playedAt: "desc" },
  });

  // Bucket matches by season id
  const buckets = new Map<string, typeof matches>();
  for (const m of matches) {
    const sid = seasonIdFor(m.playedAt);
    const arr = buckets.get(sid) ?? [];
    arr.push(m);
    buckets.set(sid, arr);
  }

  const summaries: SeasonSummary[] = [];
  for (const [id, seasonMatches] of buckets) {
    const goalCount = new Map<string, { name: string; goals: number }>();
    const mvpCount = new Map<string, { name: string; mvps: number }>();
    const record = new Map<string, { name: string; wins: number; played: number }>();

    for (const m of seasonMatches) {
      // Goals
      for (const g of m.goals) {
        const player = m.players.find((p) => p.player.id === g.scorerId)?.player;
        if (!player) continue;
        const e = goalCount.get(player.id) ?? { name: player.name, goals: 0 };
        e.goals++;
        goalCount.set(player.id, e);
      }
      // MVP
      if (m.mvp) {
        const e = mvpCount.get(m.mvp.id) ?? { name: m.mvp.name, mvps: 0 };
        e.mvps++;
        mvpCount.set(m.mvp.id, e);
      }
      // W/L record per appearance
      const diff = m.scoreA - m.scoreB;
      for (const ap of m.players) {
        const onA = ap.team === "A";
        const won = (diff > 0 && onA) || (diff < 0 && !onA);
        const e = record.get(ap.player.id) ?? { name: ap.player.name, wins: 0, played: 0 };
        e.played++;
        if (won) e.wins++;
        record.set(ap.player.id, e);
      }
    }

    const topScorer = pickMax(
      goalCount,
      (e) => e.goals,
      (id, e) => ({ playerId: id, name: e.name, value: e.goals })
    );
    const topMvp = pickMax(
      mvpCount,
      (e) => e.mvps,
      (id, e) => ({ playerId: id, name: e.name, value: e.mvps })
    );
    const bestRatio = pickMax(
      record,
      (e) => (e.played >= 3 ? e.wins / e.played : -1),
      (id, e) => ({
        playerId: id,
        name: e.name,
        value: Math.round((e.wins / e.played) * 100),
        detail: `${e.wins}/${e.played}`,
      })
    );

    summaries.push({
      id,
      label: seasonLabelFor(id),
      matchCount: seasonMatches.length,
      topScorer,
      topMvp,
      bestRatio,
    });
  }

  // Most recent first
  summaries.sort((a, b) => b.id.localeCompare(a.id));
  return summaries;
}

function pickMax<V>(
  m: Map<string, V>,
  score: (v: V) => number,
  toWinner: (id: string, v: V) => SeasonWinner
): SeasonWinner | null {
  let bestId: string | null = null;
  let bestV: V | null = null;
  let bestScore = -Infinity;
  for (const [id, v] of m) {
    const s = score(v);
    if (s > bestScore) {
      bestScore = s;
      bestId = id;
      bestV = v;
    }
  }
  if (bestId === null || bestV === null || bestScore <= 0) return null;
  return toWinner(bestId, bestV);
}
