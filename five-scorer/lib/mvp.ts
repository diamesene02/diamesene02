// Auto-compute the MVP based on goals + assists + team result.
//
// Formula (per player):
//   base  = goals * 2 + assists * 1.5
//   bonus = +2 if on winning team, +1 on draw, +0 on loss
//   (bonus only applies if the player actually contributed, i.e. G+A > 0)
//   score = base + bonus
//
// MVP = player with highest score > 0.
// Tiebreaker: goals, then assists, then name alphabetical.
// If nobody scored or assisted (e.g. 0-0), returns null.

export type MvpInput = {
  match: { scoreA: number; scoreB: number };
  players: { id: string; name: string; team: "A" | "B"; goals: number; assists: number }[];
};

export type MvpCandidate = {
  id: string;
  name: string;
  team: "A" | "B";
  goals: number;
  assists: number;
  score: number;
};

export function computeMvp(input: MvpInput): MvpCandidate | null {
  const { match, players } = input;
  const winA = match.scoreA > match.scoreB;
  const winB = match.scoreB > match.scoreA;
  const draw = match.scoreA === match.scoreB;

  const ranked: MvpCandidate[] = players
    .map((p) => {
      const contrib = p.goals + p.assists;
      const base = p.goals * 2 + p.assists * 1.5;
      const won = (p.team === "A" && winA) || (p.team === "B" && winB);
      const bonus = contrib === 0 ? 0 : won ? 2 : draw ? 1 : 0;
      return {
        id: p.id,
        name: p.name,
        team: p.team,
        goals: p.goals,
        assists: p.assists,
        score: base + bonus,
      };
    })
    .filter((c) => c.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.goals - a.goals ||
        b.assists - a.assists ||
        a.name.localeCompare(b.name)
    );

  return ranked[0] ?? null;
}

export function rankMvpCandidates(input: MvpInput): MvpCandidate[] {
  const { match, players } = input;
  const winA = match.scoreA > match.scoreB;
  const winB = match.scoreB > match.scoreA;
  const draw = match.scoreA === match.scoreB;

  return players
    .map((p) => {
      const contrib = p.goals + p.assists;
      const base = p.goals * 2 + p.assists * 1.5;
      const won = (p.team === "A" && winA) || (p.team === "B" && winB);
      const bonus = contrib === 0 ? 0 : won ? 2 : draw ? 1 : 0;
      return {
        id: p.id,
        name: p.name,
        team: p.team,
        goals: p.goals,
        assists: p.assists,
        score: base + bonus,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.goals - a.goals ||
        b.assists - a.assists ||
        a.name.localeCompare(b.name)
    );
}
