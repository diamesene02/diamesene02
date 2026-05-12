// Auto-compute the MVP based on goals + team result.
//
// Formula (per player):
//   base  = goals * 2
//   bonus = +2 if on winning team, +1 on draw, +0 on loss
//   (bonus only applies if the player actually scored)
//   score = base + bonus
//
// MVP = player with highest score > 0.
// Tiebreaker: goals, then name alphabetical.
// If nobody scored (e.g. 0-0), returns null.

export type MvpInput = {
  match: { scoreA: number; scoreB: number };
  players: { id: string; name: string; team: "A" | "B"; goals: number }[];
};

export type MvpCandidate = {
  id: string;
  name: string;
  team: "A" | "B";
  goals: number;
  score: number;
};

export function computeMvp(input: MvpInput): MvpCandidate | null {
  return rankMvpCandidates(input).filter((c) => c.score > 0)[0] ?? null;
}

export function rankMvpCandidates(input: MvpInput): MvpCandidate[] {
  const { match, players } = input;
  const winA = match.scoreA > match.scoreB;
  const winB = match.scoreB > match.scoreA;
  const draw = match.scoreA === match.scoreB;

  return players
    .map((p) => {
      const base = p.goals * 2;
      const won = (p.team === "A" && winA) || (p.team === "B" && winB);
      const bonus = p.goals === 0 ? 0 : won ? 2 : draw ? 1 : 0;
      return {
        id: p.id,
        name: p.name,
        team: p.team,
        goals: p.goals,
        score: base + bonus,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.goals - a.goals ||
        a.name.localeCompare(b.name)
    );
}
