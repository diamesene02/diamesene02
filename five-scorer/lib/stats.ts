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
  matchDayId: string | null;
  teamAName: string;
  teamBName: string;
  kind: "INTERNAL" | "EXTERNAL";
  opponentId: string | null;
  opponentName: string | null;
  isHome: boolean;
  scoreA: number;
  scoreB: number;
  mvpId: string | null;
  /// `team` est l'équipe COURANTE, `initialTeam` celle du coup d'envoi. Tous
  /// les agrégats lisent `initialTeam` : un joueur qui change de camp en cours
  /// de match ne doit pas emporter rétroactivement le résultat, l'Élo et
  /// l'étiquette de ses propres buts dans l'autre équipe.
  participants: {
    playerId: string;
    team: "A" | "B";
    initialTeam: "A" | "B";
    isGk: boolean;
  }[];
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
      participants: {
        select: { playerId: true, team: true, initialTeam: true, isGk: true },
      },
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
    matchDayId: m.matchDayId,
    teamAName: m.teamAName,
    teamBName: m.teamBName,
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
  photo: string | null;
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
      select: { id: true, name: true, nickname: true, photo: true, isGuest: true },
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
          .filter((p) => p.initialTeam === "A")
          .map((p) => p.playerId),
        teamB: m.participants
          .filter((p) => p.initialTeam === "B")
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
        photo: p.photo,
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
      const r = resultFor(part.initialTeam, m);
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
    photo: string | null;
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
      photo: true,
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
      result: resultFor(ap.initialTeam, m),
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

// ---------------------------------------------------------------------------
// Les records du club
// ---------------------------------------------------------------------------

/// Ce dont on parle au bord du terrain, et que l'app ne savait pas dire.
///
/// Un classement répond à « qui est premier ». Il ne répond pas à « c'était
/// quoi, la plus grosse fessée ? », « qui a mis quatre buts en un match ? »,
/// « avec qui je gagne ? ». Ces questions-là font la mémoire d'un club, et
/// elles se calculent entièrement à partir de ce qui est déjà enregistré.
///
/// Tout se déduit des matchs déjà chargés : aucune écriture, aucune colonne
/// de plus. Un record apparaît le jour où il existe, et pas avant — on
/// n'affiche jamais un trophée vide.
export type RecordMatch = {
  matchId: string;
  date: Date;
  nomA: string;
  nomB: string;
  scoreA: number;
  scoreB: number;
};

export type RecordJoueur = {
  playerId: string;
  name: string;
  photo: string | null;
  valeur: number;
  /// Le match ou la soirée où c'est arrivé, quand ça a un sens.
  matchId?: string;
  date?: Date;
};

export type RecordPaire = {
  a: { playerId: string; name: string; photo: string | null };
  b: { playerId: string; name: string; photo: string | null };
  ensemble: number;
  victoires: number;
  pct: number;
};

export type ClubRecords = {
  /// Le plus gros écart.
  plusLargeVictoire: (RecordMatch & { ecart: number }) | null;
  /// Le match où il en est tombé le plus, tous camps confondus.
  matchLePlusFou: (RecordMatch & { total: number }) | null;
  /// La soirée la plus prolifique.
  soireeLaPlusFolle: { matchDayId: string; date: Date; buts: number; matchs: number } | null;
  /// Le carton d'un joueur sur un seul match.
  leCarton: RecordJoueur | null;
  /// Le plus de buts d'un joueur sur une soirée entière.
  laSoireeDUnHomme: (RecordJoueur & { matchDayId: string }) | null;
  /// La plus longue série de victoires jamais enchaînée.
  laPlusLongueSerie: RecordJoueur | null;
  /// Le plus d'apparitions.
  linoxydable: RecordJoueur | null;
  /// Les deux qui gagnent le plus quand ils sont dans la même équipe.
  laPaire: RecordPaire | null;
  /// Nombre de matchs sur lesquels tout ça est calculé — pour dire au club
  /// quand un record ne veut pas encore dire grand-chose.
  matchsPrisEnCompte: number;
};

const PAIRE_MINIMUM = 4;
/// « La paire » n'a de sens que si elle gagne vraiment. Sans ce seuil, le
/// meilleur duo d'un club qui débute s'affichait à 38 % de victoires — un
/// record qui dit le contraire de ce qu'il annonce.
const PAIRE_SEUIL_PCT = 60;

export async function getClubRecords(scope: StatsScope): Promise<ClubRecords> {
  const [tous, players] = await Promise.all([
    loadFinishedMatches(scope),
    prisma.player.findMany({
      where: { clubId: scope.clubId },
      select: { id: true, name: true, photo: true },
    }),
  ]);
  const byId = new Map(players.map((p) => [p.id, p]));
  // Les records sont ceux des matchs ENTRE NOUS : un match contre un
  // adversaire extérieur n'a pas de joueurs côté B, ses écarts ne se
  // comparent pas à ceux d'un five du lundi.
  const matches = tous.filter((m) => m.kind === "INTERNAL");

  const fiche = (playerId: string, valeur: number, extra?: { matchId?: string; date?: Date }) => {
    const p = byId.get(playerId);
    if (!p) return null;
    return { playerId, name: p.name, photo: p.photo, valeur, ...extra };
  };
  const versRecordMatch = (m: LoadedMatch): RecordMatch => ({
    matchId: m.id,
    date: m.playedAt,
    nomA: m.teamAName,
    nomB: m.teamBName,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
  });

  // ── Records de match ────────────────────────────────────────────────────
  let large: LoadedMatch | null = null;
  let fou: LoadedMatch | null = null;
  for (const m of matches) {
    const ecart = Math.abs(m.scoreA - m.scoreB);
    const total = m.scoreA + m.scoreB;
    if (ecart > 0 && (!large || ecart > Math.abs(large.scoreA - large.scoreB))) large = m;
    if (total > 0 && (!fou || total > fou.scoreA + fou.scoreB)) fou = m;
  }

  // ── La soirée ───────────────────────────────────────────────────────────
  const parSoiree = new Map<string, { date: Date; buts: number; matchs: number }>();
  for (const m of matches) {
    if (!m.matchDayId) continue;
    const s = parSoiree.get(m.matchDayId) ?? { date: m.playedAt, buts: 0, matchs: 0 };
    s.buts += m.scoreA + m.scoreB;
    s.matchs += 1;
    parSoiree.set(m.matchDayId, s);
  }
  let soiree: { matchDayId: string; date: Date; buts: number; matchs: number } | null = null;
  for (const [matchDayId, s] of parSoiree) {
    if (s.buts > 0 && (!soiree || s.buts > soiree.buts)) soiree = { matchDayId, ...s };
  }

  // ── Buts d'un joueur : sur un match, puis sur une soirée ────────────────
  let carton: RecordJoueur | null = null;
  const butsParSoiree = new Map<string, Map<string, number>>();
  for (const m of matches) {
    const parJoueur = new Map<string, number>();
    for (const e of m.events) {
      if (e.type !== "GOAL" || !e.playerId) continue;
      parJoueur.set(e.playerId, (parJoueur.get(e.playerId) ?? 0) + 1);
    }
    for (const [playerId, buts] of parJoueur) {
      if (!carton || buts > carton.valeur) {
        const f = fiche(playerId, buts, { matchId: m.id, date: m.playedAt });
        if (f) carton = f;
      }
      if (m.matchDayId) {
        const s = butsParSoiree.get(m.matchDayId) ?? new Map<string, number>();
        s.set(playerId, (s.get(playerId) ?? 0) + buts);
        butsParSoiree.set(m.matchDayId, s);
      }
    }
  }
  let soireeDUnHomme: (RecordJoueur & { matchDayId: string }) | null = null;
  for (const [matchDayId, parJoueur] of butsParSoiree) {
    for (const [playerId, buts] of parJoueur) {
      // Le record de la soirée n'a d'intérêt que s'il dépasse celui du match :
      // sinon c'est deux fois la même ligne.
      if (buts > (carton?.valeur ?? 0) && (!soireeDUnHomme || buts > soireeDUnHomme.valeur)) {
        const f = fiche(playerId, buts, { date: parSoiree.get(matchDayId)?.date });
        if (f) soireeDUnHomme = { ...f, matchDayId };
      }
    }
  }

  // ── Séries, apparitions, paires ────────────────────────────────────────
  const serieEnCours = new Map<string, number>();
  const meilleureSerie = new Map<string, number>();
  const apparitions = new Map<string, number>();
  const paires = new Map<string, { ensemble: number; victoires: number }>();

  for (const m of matches) {
    for (const camp of ["A", "B"] as const) {
      const equipe = m.participants
        .filter((p) => p.initialTeam === camp)
        .map((p) => p.playerId);
      const gagne = resultFor(camp, m) === "W";
      for (const id of equipe) {
        apparitions.set(id, (apparitions.get(id) ?? 0) + 1);
        const s = gagne ? (serieEnCours.get(id) ?? 0) + 1 : 0;
        serieEnCours.set(id, s);
        if (s > (meilleureSerie.get(id) ?? 0)) meilleureSerie.set(id, s);
      }
      for (let i = 0; i < equipe.length; i++) {
        for (let j = i + 1; j < equipe.length; j++) {
          const cle = [equipe[i], equipe[j]].sort().join("|");
          const p = paires.get(cle) ?? { ensemble: 0, victoires: 0 };
          p.ensemble += 1;
          if (gagne) p.victoires += 1;
          paires.set(cle, p);
        }
      }
    }
  }

  const meilleurDe = (m: Map<string, number>): RecordJoueur | null => {
    let top: { id: string; v: number } | null = null;
    for (const [id, v] of m) if (v > 0 && (!top || v > top.v)) top = { id, v };
    return top ? fiche(top.id, top.v) : null;
  };

  let paire: RecordPaire | null = null;
  for (const [cle, p] of paires) {
    if (p.ensemble < PAIRE_MINIMUM) continue;
    const pct = (p.victoires / p.ensemble) * 100;
    if (paire && pct <= paire.pct) continue;
    const [ida, idb] = cle.split("|");
    const a = byId.get(ida);
    const b = byId.get(idb);
    if (!a || !b) continue;
    paire = {
      a: { playerId: a.id, name: a.name, photo: a.photo },
      b: { playerId: b.id, name: b.name, photo: b.photo },
      ensemble: p.ensemble,
      victoires: p.victoires,
      pct: Math.round(pct),
    };
  }

  return {
    plusLargeVictoire: large
      ? { ...versRecordMatch(large), ecart: Math.abs(large.scoreA - large.scoreB) }
      : null,
    matchLePlusFou: fou
      ? { ...versRecordMatch(fou), total: fou.scoreA + fou.scoreB }
      : null,
    soireeLaPlusFolle: soiree && soiree.matchs > 1 ? soiree : null,
    leCarton: carton && carton.valeur > 1 ? carton : null,
    laSoireeDUnHomme: soireeDUnHomme,
    laPlusLongueSerie: (() => {
      const r = meilleurDe(meilleureSerie);
      return r && r.valeur > 1 ? r : null;
    })(),
    linoxydable: meilleurDe(apparitions),
    laPaire: paire && paire.pct >= PAIRE_SEUIL_PCT ? paire : null,
    matchsPrisEnCompte: matches.length,
  };
}

// ---------------------------------------------------------------------------
// Le derby de la saison : les deux chasubles, sur toute l'année
// ---------------------------------------------------------------------------

/// Un club de five joue toute la saison avec les deux MÊMES chasubles.
///
/// C'est même sa singularité : ce n'est pas une équipe contre des adversaires
/// qui changent, c'est un derby permanent — quarante lundis, quatre à huit
/// matchs par soir, toujours Blanc contre Noir. Personne ne tenait ce compte,
/// alors que c'est la seule confrontation qui dure toute l'année.
export type Derby = {
  nomA: string;
  nomB: string;
  matchs: number;
  victoiresA: number;
  victoiresB: number;
  nuls: number;
  butsA: number;
  butsB: number;
  /// La série en cours, du point de vue de la chasuble qui mène : positive
  /// pour A, négative pour B, 0 si le dernier match était nul.
  serie: number;
  /// Les soirées gagnées : une soirée revient à qui a gagné le plus de matchs.
  soireesA: number;
  soireesB: number;
  soireesPartagees: number;
};

export async function getDerby(scope: StatsScope): Promise<Derby | null> {
  const matches = (await loadFinishedMatches(scope)).filter(
    (m) => m.kind === "INTERNAL",
  );
  if (matches.length === 0) return null;

  // Les noms : ceux du match le plus récent, qui reflètent les chasubles
  // réglées aujourd'hui.
  const dernier = matches[matches.length - 1];
  const d: Derby = {
    nomA: dernier.teamAName,
    nomB: dernier.teamBName,
    matchs: matches.length,
    victoiresA: 0,
    victoiresB: 0,
    nuls: 0,
    butsA: 0,
    butsB: 0,
    serie: 0,
    soireesA: 0,
    soireesB: 0,
    soireesPartagees: 0,
  };

  for (const m of matches) {
    d.butsA += m.scoreA;
    d.butsB += m.scoreB;
    if (m.scoreA > m.scoreB) d.victoiresA += 1;
    else if (m.scoreB > m.scoreA) d.victoiresB += 1;
    else d.nuls += 1;
  }

  // La série : on remonte le temps tant que le même camp gagne.
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const vainqueur = m.scoreA > m.scoreB ? 1 : m.scoreB > m.scoreA ? -1 : 0;
    if (vainqueur === 0) break;
    if (d.serie === 0) d.serie = vainqueur;
    else if (Math.sign(d.serie) !== vainqueur) break;
    else d.serie += vainqueur;
  }

  // Les soirées : une soirée revient à qui y a gagné le plus de matchs.
  const parSoiree = new Map<string, { a: number; b: number }>();
  for (const m of matches) {
    if (!m.matchDayId) continue;
    const s = parSoiree.get(m.matchDayId) ?? { a: 0, b: 0 };
    if (m.scoreA > m.scoreB) s.a += 1;
    else if (m.scoreB > m.scoreA) s.b += 1;
    parSoiree.set(m.matchDayId, s);
  }
  for (const s of parSoiree.values()) {
    if (s.a > s.b) d.soireesA += 1;
    else if (s.b > s.a) d.soireesB += 1;
    else d.soireesPartagees += 1;
  }

  return d;
}

// ---------------------------------------------------------------------------
// Trophées et paliers d'un joueur
// ---------------------------------------------------------------------------

/// Ce qu'un joueur a décroché, et ce qui lui reste à deux pas.
///
/// Un classement ne récompense que le premier. Or dans un five, le dixième
/// aussi a une histoire : son premier but, son premier triplé, sa série de
/// trois. Ces jalons existaient déjà dans les données — personne ne les
/// nommait.
///
/// Les paliers comptent autant que les trophées : « encore deux buts » fait
/// revenir le lundi suivant, là où « 8 buts » ne dit rien.
export type Trophee = {
  cle: string;
  nom: string;
  detail: string;
  /// Date d'obtention — seulement pour ceux qu'on sait dater.
  date?: Date;
};

export type Palier = {
  cle: string;
  /// L'intitulé de la rangée : « Buts », « Homme du match ».
  titre: string;
  /// L'unité, aux deux nombres. Un `replace` du « s » final marchait pour
  /// « buts », pas pour « titres d'homme du match » — la marque du pluriel
  /// n'est pas toujours à la fin, et l'intitulé porte déjà le contexte.
  nom: string;
  nomSingulier: string;
  actuel: number;
  objectif: number;
};

export type TropheesJoueur = {
  obtenus: Trophee[];
  paliers: Palier[];
};

const PALIERS_BUTS = [1, 5, 10, 25, 50, 100, 200];
const PALIERS_MATCHS = [1, 10, 25, 50, 100, 200];
const PALIERS_VICTOIRES = [1, 10, 25, 50, 100];
const PALIERS_MVP = [1, 3, 5, 10, 25];

export async function getTropheesJoueur(
  clubId: string,
  playerId: string,
): Promise<TropheesJoueur> {
  const matches = (await loadFinishedMatches({ clubId })).filter((m) =>
    m.participants.some((p) => p.playerId === playerId),
  );

  let buts = 0;
  let joues = 0;
  let victoires = 0;
  let mvp = 0;
  let serie = 0;
  let meilleureSerie = 0;
  let meilleurMatch = 0;
  const dates = new Map<string, Date>();
  const marque = (cle: string, d: Date) => {
    if (!dates.has(cle)) dates.set(cle, d);
  };

  for (const m of matches) {
    const part = m.participants.find((p) => p.playerId === playerId);
    if (!part) continue;
    joues += 1;
    for (const seuil of PALIERS_MATCHS) {
      if (joues === seuil) marque(`matchs-${seuil}`, m.playedAt);
    }

    const butsDuMatch = m.events.filter(
      (e) => e.type === "GOAL" && e.playerId === playerId,
    ).length;
    for (let i = 1; i <= butsDuMatch; i++) {
      buts += 1;
      for (const seuil of PALIERS_BUTS) {
        if (buts === seuil) marque(`buts-${seuil}`, m.playedAt);
      }
    }
    if (butsDuMatch > meilleurMatch) meilleurMatch = butsDuMatch;
    if (butsDuMatch >= 3) marque("triple", m.playedAt);
    if (butsDuMatch >= 4) marque("quadruple", m.playedAt);

    const res = resultFor(part.initialTeam, m);
    if (res === "W") {
      victoires += 1;
      for (const seuil of PALIERS_VICTOIRES) {
        if (victoires === seuil) marque(`victoires-${seuil}`, m.playedAt);
      }
      serie += 1;
      if (serie > meilleureSerie) meilleureSerie = serie;
      if (serie === 3) marque("serie-3", m.playedAt);
      if (serie === 5) marque("serie-5", m.playedAt);
      if (serie === 10) marque("serie-10", m.playedAt);
    } else {
      serie = 0;
    }

    if (m.mvpId === playerId) {
      mvp += 1;
      for (const seuil of PALIERS_MVP) {
        if (mvp === seuil) marque(`mvp-${seuil}`, m.playedAt);
      }
    }
  }

  const obtenus: Trophee[] = [];
  const ajoute = (cle: string, nom: string, detail: string) => {
    const date = dates.get(cle);
    if (date) obtenus.push({ cle, nom, detail, date });
  };

  ajoute("matchs-1", "Première", "Premier match sous ces couleurs");
  ajoute("buts-1", "Premier but", "Le premier, on s'en souvient");
  ajoute("triple", "Triplé", "Trois buts dans le même match");
  ajoute("quadruple", "Quadruplé", "Quatre buts dans le même match");
  for (const s of [5, 10, 25, 50, 100, 200]) {
    ajoute(`buts-${s}`, `${s} buts`, "Au compteur");
  }
  for (const s of [10, 25, 50, 100, 200]) {
    ajoute(`matchs-${s}`, `${s} matchs`, "Toujours là");
  }
  for (const s of [10, 25, 50, 100]) {
    ajoute(`victoires-${s}`, `${s} victoires`, "Du bon côté");
  }
  ajoute("serie-3", "Série de 3", "Trois victoires d'affilée");
  ajoute("serie-5", "Série de 5", "Cinq victoires d'affilée");
  ajoute("serie-10", "Série de 10", "Dix victoires d'affilée");
  ajoute("mvp-1", "Homme du match", "Élu une fois");
  for (const s of [3, 5, 10, 25]) {
    ajoute(`mvp-${s}`, `${s} fois homme du match`, "Le patron");
  }

  // Le plus récent d'abord : un trophée d'hier vaut mieux qu'un d'il y a un an.
  obtenus.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

  const prochain = (
    cle: string,
    titre: string,
    nom: string,
    nomSingulier: string,
    actuel: number,
    seuils: number[],
  ): Palier | null => {
    const objectif = seuils.find((s) => s > actuel);
    return objectif ? { cle, titre, nom, nomSingulier, actuel, objectif } : null;
  };

  const paliers = [
    prochain("buts", "Buts", "buts", "but", buts, PALIERS_BUTS),
    prochain("matchs", "Matchs", "matchs", "match", joues, PALIERS_MATCHS),
    prochain("victoires", "Victoires", "victoires", "victoire", victoires, PALIERS_VICTOIRES),
    // Le palier « homme du match » n'a de sens qu'une fois lancé : proposer
    // « 1 titre » à quelqu'un qui n'en a aucun, c'est lui rappeler qu'il n'en
    // a aucun.
    mvp > 0
      ? prochain("mvp", "Homme du match", "titres", "titre", mvp, PALIERS_MVP)
      : null,
  ].filter((p): p is Palier => p !== null);

  return { obtenus, paliers };
}

// ---------------------------------------------------------------------------
// Le gardien
// ---------------------------------------------------------------------------

/// Le poste que l'app enregistrait sans jamais le regarder.
///
/// Chaque feuille de match note qui garde les buts — c'est dans les compos
/// depuis le premier jour. Aucun écran ne s'en servait : un gardien
/// n'apparaissait au classement que par ses buts, c'est-à-dire par ce qu'il
/// ne fait pas. Ses chiffres à lui sont les buts encaissés, les matchs sans
/// encaisser, et ce que devient l'équipe quand il est derrière.
export type StatsGardien = {
  playerId: string;
  name: string;
  photo: string | null;
  matchs: number;
  encaisses: number;
  /// Buts encaissés par match, à une décimale.
  moyenne: number;
  cleanSheets: number;
  victoires: number;
  nuls: number;
  defaites: number;
  /// Pourcentage de victoires quand il garde.
  pctVictoires: number;
};

export async function getGardiens(scope: StatsScope): Promise<StatsGardien[]> {
  const [matches, players] = await Promise.all([
    loadFinishedMatches(scope),
    prisma.player.findMany({
      where: { clubId: scope.clubId },
      select: { id: true, name: true, photo: true },
    }),
  ]);
  const byId = new Map(players.map((p) => [p.id, p]));
  const acc = new Map<string, StatsGardien>();

  for (const m of matches) {
    if (m.kind !== "INTERNAL") continue;
    for (const part of m.participants) {
      if (!part.isGk) continue;
      const p = byId.get(part.playerId);
      if (!p) continue;
      let g = acc.get(part.playerId);
      if (!g) {
        g = {
          playerId: p.id,
          name: p.name,
          photo: p.photo,
          matchs: 0,
          encaisses: 0,
          moyenne: 0,
          cleanSheets: 0,
          victoires: 0,
          nuls: 0,
          defaites: 0,
          pctVictoires: 0,
        };
        acc.set(part.playerId, g);
      }
      // Encaissé = ce que l'AUTRE camp a marqué. Un contre son camp compte
      // pour l'équipe qui en profite, il est donc déjà du bon côté du score.
      const pris = part.initialTeam === "A" ? m.scoreB : m.scoreA;
      g.matchs += 1;
      g.encaisses += pris;
      if (pris === 0) g.cleanSheets += 1;
      const r = resultFor(part.initialTeam, m);
      if (r === "W") g.victoires += 1;
      else if (r === "D") g.nuls += 1;
      else g.defaites += 1;
    }
  }

  const out = [...acc.values()].map((g) => ({
    ...g,
    moyenne: g.matchs > 0 ? Math.round((g.encaisses / g.matchs) * 10) / 10 : 0,
    pctVictoires: g.matchs > 0 ? Math.round((g.victoires / g.matchs) * 100) : 0,
  }));
  // Le meilleur d'abord : moins on encaisse, mieux c'est.
  //
  // Mais une moyenne sur un match n'est pas une moyenne : celui qui a pris un
  // but le seul soir où il a mis les gants se retrouvait en tête devant celui
  // qui garde tous les lundis. Les gardiens réguliers sont classés entre eux,
  // les dépanneurs viennent après — la colonne MJ dit pourquoi.
  const REGULIER = 3;
  out.sort((a, b) => {
    const ra = a.matchs >= REGULIER ? 0 : 1;
    const rb = b.matchs >= REGULIER ? 0 : 1;
    return ra - rb || a.moyenne - b.moyenne || b.matchs - a.matchs;
  });
  return out;
}
