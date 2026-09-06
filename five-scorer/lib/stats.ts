import "server-only";

import { prisma } from "@/lib/prisma";
import { computeElo } from "@/lib/elo";

// Moteur de stats v2 — tout est scopé (clubId, seasonId?).
// Stratégie : une seule requête charge les matchs FINISHED du scope avec
// compos + events, puis tout se calcule en mémoire (un club = quelques
// centaines de matchs max, trivial).

export type StatsScope = {
  clubId: string;
  seasonId?: string | null; // undefined/null = toutes saisons
  matchDayId?: string | null; // classement d'une seule soirée
};

type LoadedMatch = {
  id: string;
  playedAt: Date;
  kind: "INTERNAL" | "EXTERNAL";
  opponentId: string | null;
  opponentName: string | null;
  isHome: boolean;
  scoreA: number;
  scoreB: number;
  mvpId: string | null;
  participants: { playerId: string; team: "A" | "B" }[];
  events: {
    type: "GOAL" | "OWN_GOAL" | "YELLOW_CARD" | "RED_CARD" | "HALF_TIME";
    team: "A" | "B";
    playerId: string | null;
    assistPlayerId: string | null;
  }[];
};

async function loadFinishedMatches(scope: StatsScope): Promise<LoadedMatch[]> {
  const matches = await prisma.match.findMany({
    where: {
      clubId: scope.clubId,
      status: "FINISHED",
      ...(scope.seasonId ? { seasonId: scope.seasonId } : {}),
      ...(scope.matchDayId ? { matchDayId: scope.matchDayId } : {}),
    },
    orderBy: { playedAt: "asc" },
    include: {
      opponent: { select: { name: true } },
      participants: { select: { playerId: true, team: true } },
      events: {
        select: {
          type: true,
          team: true,
          playerId: true,
          assistPlayerId: true,
        },
      },
    },
  });
  return matches.map((m) => ({
    id: m.id,
    playedAt: m.playedAt,
    kind: m.kind,
    opponentId: m.opponentId,
    opponentName: m.opponent?.name ?? null,
    isHome: m.isHome,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    mvpId: m.mvpId,
    participants: m.participants,
    events: m.events,
  }));
}

export type Result = "W" | "D" | "L";

function resultFor(
  team: "A" | "B",
  m: { scoreA: number; scoreB: number },
): Result {
  const diff = m.scoreA - m.scoreB;
  if (diff === 0) return "D";
  return diff > 0 === (team === "A") ? "W" : "L";
}

// ---------------------------------------------------------------------------
// Classement joueurs (buteurs, passeurs, victoires, MVP, forme, séries)
// ---------------------------------------------------------------------------

export type LeaderboardRow = {
  playerId: string;
  name: string;
  nickname: string | null;
  isGuest: boolean;
  matchesPlayed: number;
  goals: number;
  assists: number;
  ownGoals: number;
  yellow: number;
  red: number;
  wins: number;
  draws: number;
  losses: number;
  winPct: number; // 0..100
  mvpCount: number;
  goalsPerMatch: number;
  /// 5 derniers résultats, du plus récent au plus ancien.
  form: Result[];
  /// Série en cours : ex. +3 (3 victoires d'affilée), -2 (2 défaites), 0.
  streak: number;
  /// Cote Élo (matchs internes du scope uniquement). 1000 = base.
  elo: number;
  /// Delta Élo vs il y a 5 de SES matchs (0 si moins de 5 matchs internes).
  eloTrend: number;
};

const ELO_BASE = 1000;

export async function getLeaderboard(
  scope: StatsScope,
): Promise<LeaderboardRow[]> {
  const [matches, players] = await Promise.all([
    loadFinishedMatches(scope),
    prisma.player.findMany({
      where: { clubId: scope.clubId },
      select: { id: true, name: true, nickname: true, isGuest: true },
    }),
  ]);
  const byId = new Map(players.map((p) => [p.id, p]));

  // Élo : matchs INTERNAL uniquement (entre nous — un EXTERNAL n'a pas de
  // joueurs côté B). `matches` est déjà chronologique.
  const eloHistories = computeElo(
    matches
      .filter((m) => m.kind === "INTERNAL")
      .map((m) => ({
        teamA: m.participants
          .filter((p) => p.team === "A")
          .map((p) => p.playerId),
        teamB: m.participants
          .filter((p) => p.team === "B")
          .map((p) => p.playerId),
        scoreA: m.scoreA,
        scoreB: m.scoreB,
      })),
    ELO_BASE,
  );

  type Acc = Omit<
    LeaderboardRow,
    "winPct" | "goalsPerMatch" | "streak" | "elo" | "eloTrend"
  > & {
    results: Result[]; // ordre chronologique
  };
  const acc = new Map<string, Acc>();
  const ensure = (playerId: string): Acc | null => {
    const p = byId.get(playerId);
    if (!p) return null;
    let a = acc.get(playerId);
    if (!a) {
      a = {
        playerId,
        name: p.name,
        nickname: p.nickname,
        isGuest: p.isGuest,
        matchesPlayed: 0,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        yellow: 0,
        red: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        mvpCount: 0,
        form: [],
        results: [],
      };
      acc.set(playerId, a);
    }
    return a;
  };

  for (const m of matches) {
    for (const part of m.participants) {
      const a = ensure(part.playerId);
      if (!a) continue;
      a.matchesPlayed++;
      const r = resultFor(part.team, m);
      a.results.push(r);
      if (r === "W") a.wins++;
      else if (r === "D") a.draws++;
      else a.losses++;
    }
    for (const e of m.events) {
      if (e.type === "GOAL") {
        if (e.playerId) ensure(e.playerId) && (acc.get(e.playerId)!.goals += 1);
        if (e.assistPlayerId)
          ensure(e.assistPlayerId) && (acc.get(e.assistPlayerId)!.assists += 1);
      } else if (e.type === "OWN_GOAL" && e.playerId) {
        ensure(e.playerId) && (acc.get(e.playerId)!.ownGoals += 1);
      } else if (e.type === "YELLOW_CARD" && e.playerId) {
        ensure(e.playerId) && (acc.get(e.playerId)!.yellow += 1);
      } else if (e.type === "RED_CARD" && e.playerId) {
        ensure(e.playerId) && (acc.get(e.playerId)!.red += 1);
      }
    }
    if (m.mvpId) {
      const a = ensure(m.mvpId);
      if (a) a.mvpCount++;
    }
  }

  return Array.from(acc.values())
    .map((a) => {
      let streak = 0;
      for (let i = a.results.length - 1; i >= 0; i--) {
        const r = a.results[i];
        if (r === "D") break;
        if (streak === 0) streak = r === "W" ? 1 : -1;
        else if (r === "W" && streak > 0) streak++;
        else if (r === "L" && streak < 0) streak--;
        else break;
      }
      const hist = eloHistories.get(a.playerId) ?? [];
      const elo =
        hist.length > 0 ? Math.round(hist[hist.length - 1]) : ELO_BASE;
      const eloTrend =
        hist.length >= 5
          ? Math.round(
              hist[hist.length - 1] -
                (hist.length >= 6 ? hist[hist.length - 6] : ELO_BASE),
            )
          : 0;
      const { results, ...row } = a;
      return {
        ...row,
        elo,
        eloTrend,
        form: results.slice(-5).reverse(),
        winPct:
          a.matchesPlayed > 0
            ? Math.round((a.wins / a.matchesPlayed) * 100)
            : 0,
        goalsPerMatch:
          a.matchesPlayed > 0
            ? Math.round((a.goals / a.matchesPlayed) * 100) / 100
            : 0,
        streak,
      };
    })
    .sort(
      (x, y) =>
        y.goals - x.goals ||
        y.winPct - x.winPct ||
        y.matchesPlayed - x.matchesPlayed ||
        x.name.localeCompare(y.name),
    );
}

// ---------------------------------------------------------------------------
// Palmarès de saison (saisons clôturées)
// ---------------------------------------------------------------------------

export type HonourEntry = {
  playerId: string;
  name: string;
  value: number;
} | null;

export type SeasonHonours = {
  seasonName: string;
  /// Meilleur buteur.
  topScorer: HonourEntry;
  /// Meilleur passeur.
  topAssister: HonourEntry;
  /// Plus de titres MVP.
  topMvp: HonourEntry;
  /// Meilleur % de victoires (min 5 matchs).
  topWinPct: HonourEntry;
  /// Élo le plus haut.
  topElo: HonourEntry;
  /// L'inoxydable : plus d'apparitions.
  ironMan: HonourEntry;
};

export async function getSeasonHonours(
  clubId: string,
  seasonId: string,
): Promise<SeasonHonours | null> {
  const season = await prisma.season.findFirst({
    where: { id: seasonId, clubId },
    select: { name: true },
  });
  if (!season) return null;

  const rows = await getLeaderboard({ clubId, seasonId });

  const best = (
    value: (r: LeaderboardRow) => number,
    candidates: LeaderboardRow[] = rows,
  ): HonourEntry => {
    let top: LeaderboardRow | null = null;
    for (const r of candidates) {
      if (!top || value(r) > value(top)) top = r;
    }
    if (!top || value(top) <= 0) return null;
    return { playerId: top.playerId, name: top.name, value: value(top) };
  };

  // Élo : on saute le trophée si personne n'a bougé de la base (aucun match
  // interne cette saison-là).
  const eloMoved = rows.some((r) => r.elo !== 1000);

  return {
    seasonName: season.name,
    topScorer: best((r) => r.goals),
    topAssister: best((r) => r.assists),
    topMvp: best((r) => r.mvpCount),
    topWinPct: best(
      (r) => r.winPct,
      rows.filter((r) => r.matchesPlayed >= 5),
    ),
    topElo: eloMoved ? best((r) => r.elo) : null,
    ironMan: best((r) => r.matchesPlayed),
  };
}

// ---------------------------------------------------------------------------
// Fiche joueur
// ---------------------------------------------------------------------------

export type PlayerDetail = {
  player: {
    id: string;
    name: string;
    nickname: string | null;
    isGuest: boolean;
    skill: number;
    isGk: boolean;
    userId: string | null;
  };
  allTime: LeaderboardRow | null;
  bySeason: {
    seasonId: string | null;
    seasonName: string;
    row: LeaderboardRow;
  }[];
  recentMatches: {
    id: string;
    playedAt: string;
    label: string;
    score: string;
    result: Result;
    goals: number;
    wasMvp: boolean;
  }[];
};

export async function getPlayerDetail(
  clubId: string,
  playerId: string,
): Promise<PlayerDetail | null> {
  const player = await prisma.player.findFirst({
    where: { id: playerId, clubId },
    select: {
      id: true,
      name: true,
      nickname: true,
      isGuest: true,
      skill: true,
      isGk: true,
      userId: true,
    },
  });
  if (!player) return null;

  const [allRows, seasons, appearances] = await Promise.all([
    getLeaderboard({ clubId }),
    prisma.season.findMany({
      where: { clubId },
      orderBy: { startsAt: "desc" },
      select: { id: true, name: true },
    }),
    prisma.matchParticipant.findMany({
      where: { playerId, match: { clubId, status: "FINISHED" } },
      include: {
        match: {
          select: {
            id: true,
            playedAt: true,
            teamAName: true,
            teamBName: true,
            scoreA: true,
            scoreB: true,
            mvpId: true,
            kind: true,
            opponent: { select: { name: true } },
            events: { select: { type: true, playerId: true } },
          },
        },
      },
      orderBy: { match: { playedAt: "desc" } },
      take: 10,
    }),
  ]);

  const bySeason: PlayerDetail["bySeason"] = [];
  for (const s of seasons) {
    const rows = await getLeaderboard({ clubId, seasonId: s.id });
    const row = rows.find((r) => r.playerId === playerId);
    if (row) bySeason.push({ seasonId: s.id, seasonName: s.name, row });
  }

  const recentMatches = appearances.map((ap) => {
    const m = ap.match;
    const label =
      m.kind === "EXTERNAL" && m.opponent
        ? `vs ${m.opponent.name}`
        : `${m.teamAName} vs ${m.teamBName}`;
    return {
      id: m.id,
      playedAt: m.playedAt.toISOString(),
      label,
      score: `${m.scoreA}-${m.scoreB}`,
      result: resultFor(ap.team, m),
      goals: m.events.filter(
        (e) => e.type === "GOAL" && e.playerId === playerId,
      ).length,
      wasMvp: m.mvpId === playerId,
    };
  });

  return {
    player,
    allTime: allRows.find((r) => r.playerId === playerId) ?? null,
    bySeason,
    recentMatches,
  };
}

// ---------------------------------------------------------------------------
// Bilan des matchs externes (vs adversaires) + head-to-head
// ---------------------------------------------------------------------------

export type ExternalRecord = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: Result[];
  byOpponent: {
    opponentId: string;
    name: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
  }[];
};

export async function getExternalRecord(
  scope: StatsScope,
  points: { win: number; draw: number },
): Promise<ExternalRecord> {
  const matches = (await loadFinishedMatches(scope)).filter(
    (m) => m.kind === "EXTERNAL",
  );
  const rec: ExternalRecord = {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    form: [],
    byOpponent: [],
  };
  const opp = new Map<string, ExternalRecord["byOpponent"][number]>();
  const chrono: Result[] = [];

  for (const m of matches) {
    // Le club est toujours l'équipe A d'un match EXTERNAL.
    const r = resultFor("A", m);
    rec.played++;
    rec.goalsFor += m.scoreA;
    rec.goalsAgainst += m.scoreB;
    if (r === "W") (rec.wins++, (rec.points += points.win));
    else if (r === "D") (rec.draws++, (rec.points += points.draw));
    else rec.losses++;
    chrono.push(r);

    if (m.opponentId) {
      let o = opp.get(m.opponentId);
      if (!o) {
        o = {
          opponentId: m.opponentId,
          name: m.opponentName ?? "?",
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
        };
        opp.set(m.opponentId, o);
      }
      o.played++;
      o.goalsFor += m.scoreA;
      o.goalsAgainst += m.scoreB;
      if (r === "W") o.wins++;
      else if (r === "D") o.draws++;
      else o.losses++;
    }
  }

  rec.form = chrono.slice(-5).reverse();
  rec.byOpponent = Array.from(opp.values()).sort((a, b) => b.played - a.played);
  return rec;
}

// ---------------------------------------------------------------------------
// Résumé club (dashboard)
// ---------------------------------------------------------------------------

export type ClubSummary = {
  matchesPlayed: number;
  totalGoals: number;
  topScorer: { playerId: string; name: string; goals: number } | null;
  topMvp: { playerId: string; name: string; count: number } | null;
  activePlayers: number;
};

export async function getClubSummary(scope: StatsScope): Promise<ClubSummary> {
  const rows = await getLeaderboard(scope);
  const matches = await prisma.match.count({
    where: {
      clubId: scope.clubId,
      status: "FINISHED",
      ...(scope.seasonId ? { seasonId: scope.seasonId } : {}),
    },
  });
  const top = [...rows].sort((a, b) => b.goals - a.goals)[0];
  const mvp = [...rows].sort((a, b) => b.mvpCount - a.mvpCount)[0];
  return {
    matchesPlayed: matches,
    totalGoals: rows.reduce((s, r) => s + r.goals, 0),
    topScorer:
      top && top.goals > 0
        ? { playerId: top.playerId, name: top.name, goals: top.goals }
        : null,
    topMvp:
      mvp && mvp.mvpCount > 0
        ? { playerId: mvp.playerId, name: mvp.name, count: mvp.mvpCount }
        : null,
    activePlayers: rows.filter((r) => r.matchesPlayed > 0).length,
  };
}
