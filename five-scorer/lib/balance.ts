// Générateur d'équipes équilibrées.
//
// Entrée : les joueurs présents (note 1..5 + flag gardien + forme récente
// optionnelle). Sortie : deux équipes minimisant l'écart de force totale,
// avec les gardiens répartis en premier.
//
// Algo : distribution serpentin (snake draft) comme point de départ, puis
// recherche locale par échanges de paires (hill climbing). Plusieurs
// redémarrages aléatoires → on peut proposer un "re-tirage" différent à
// chaque tap tout en restant équilibré.

export type BalanceInput = {
  id: string;
  name: string;
  skill: number; // 1..5
  isGk: boolean;
  /// Bonus/malus de forme (-1..+1), ex. dérivé du % de victoires récent.
  form?: number;
};

export type BalancedTeams = {
  teamA: BalanceInput[];
  teamB: BalanceInput[];
  strengthA: number;
  strengthB: number;
  /// Écart de force résiduel (0 = parfait).
  gap: number;
};

function strength(p: BalanceInput): number {
  return p.skill + (p.form ?? 0) * 0.5;
}

function total(team: BalanceInput[]): number {
  return team.reduce((s, p) => s + strength(p), 0);
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/// Serpentin : tri par force décroissante, distribution A-B-B-A-A-B…
function snakeSeed(players: BalanceInput[]): [BalanceInput[], BalanceInput[]] {
  const sorted = [...players].sort((a, b) => strength(b) - strength(a));
  const teamA: BalanceInput[] = [];
  const teamB: BalanceInput[] = [];
  sorted.forEach((p, i) => {
    const round = Math.floor(i / 2);
    const first = round % 2 === 0;
    if (i % 2 === 0) (first ? teamA : teamB).push(p);
    else (first ? teamB : teamA).push(p);
  });
  return [teamA, teamB];
}

/// Échanges de paires tant que ça réduit l'écart.
function localSearch(
  teamA: BalanceInput[],
  teamB: BalanceInput[]
): [BalanceInput[], BalanceInput[]] {
  const a = [...teamA];
  const b = [...teamB];
  let improved = true;
  while (improved) {
    improved = false;
    let bestGap = Math.abs(total(a) - total(b));
    let bestSwap: [number, number] | null = null;
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        // Ne pas casser la répartition des gardiens.
        if (a[i].isGk !== b[j].isGk) continue;
        const delta = strength(b[j]) - strength(a[i]);
        const gap = Math.abs(total(a) - total(b) + 2 * delta);
        if (gap < bestGap - 1e-9) {
          bestGap = gap;
          bestSwap = [i, j];
        }
      }
    }
    if (bestSwap) {
      const [i, j] = bestSwap;
      [a[i], b[j]] = [b[j], a[i]];
      improved = true;
    }
  }
  return [a, b];
}

export function balanceTeams(
  players: BalanceInput[],
  opts: { seed?: number } = {}
): BalancedTeams {
  if (players.length < 2) {
    return {
      teamA: players,
      teamB: [],
      strengthA: total(players),
      strengthB: 0,
      gap: total(players),
    };
  }

  // PRNG déterministe par seed → le bouton "re-tirer" passe seed+1.
  let s = (opts.seed ?? 1) >>> 0 || 1;
  const rng = () => {
    // xorshift32
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };

  const gks = shuffle(players.filter((p) => p.isGk), rng);
  const field = shuffle(players.filter((p) => !p.isGk), rng);

  // Les gardiens d'abord, un par équipe tant qu'il y en a.
  const [gkA, gkB] = snakeSeed(gks);
  const [fA, fB] = snakeSeed(field);

  // Équilibre des effectifs si les tailles divergent (nb impair, GK groupés…).
  let teamA = [...gkA, ...fA];
  let teamB = [...gkB, ...fB];
  while (teamA.length - teamB.length > 1) teamB.push(teamA.pop()!);
  while (teamB.length - teamA.length > 1) teamA.push(teamB.pop()!);

  [teamA, teamB] = localSearch(teamA, teamB);

  const strengthA = total(teamA);
  const strengthB = total(teamB);
  return {
    teamA,
    teamB,
    strengthA,
    strengthB,
    gap: Math.abs(strengthA - strengthB),
  };
}
