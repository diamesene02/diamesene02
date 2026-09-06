// Moteur Élo — pur, aucun accès DB, aucune dépendance.
//
// Fold chronologique : la cote d'une équipe est la moyenne des cotes
// courantes de ses membres ; chaque membre d'une équipe encaisse le même
// delta. Le K est pondéré par l'écart au score (un 8-1 pèse plus qu'un 3-2).

export type EloMatch = {
  teamA: string[]; // player ids
  teamB: string[];
  scoreA: number;
  scoreB: number;
};

/// Rejoue les matchs dans l'ordre et renvoie, pour chaque joueur,
/// l'historique de sa cote APRÈS chacun de SES matchs (départ implicite à
/// `base`). Les matchs avec un côté vide sont ignorés.
export function computeElo(
  matches: EloMatch[],
  base = 1000,
  k = 32,
): Map<string, number[]> {
  const current = new Map<string, number>();
  const history = new Map<string, number[]>();
  const ratingOf = (id: string) => current.get(id) ?? base;

  for (const m of matches) {
    if (m.teamA.length === 0 || m.teamB.length === 0) continue;

    const ra = m.teamA.reduce((s, id) => s + ratingOf(id), 0) / m.teamA.length;
    const rb = m.teamB.reduce((s, id) => s + ratingOf(id), 0) / m.teamB.length;

    const expectedA = 1 / (1 + Math.pow(10, (rb - ra) / 400));
    const resultA = m.scoreA > m.scoreB ? 1 : m.scoreA < m.scoreB ? 0 : 0.5;
    const weight = Math.min(2, 1 + Math.abs(m.scoreA - m.scoreB) / 4);
    const delta = k * weight * (resultA - expectedA);

    for (const id of m.teamA) {
      const next = ratingOf(id) + delta;
      current.set(id, next);
      let h = history.get(id);
      if (!h) {
        h = [];
        history.set(id, h);
      }
      h.push(next);
    }
    for (const id of m.teamB) {
      const next = ratingOf(id) - delta;
      current.set(id, next);
      let h = history.get(id);
      if (!h) {
        h = [];
        history.set(id, h);
      }
      h.push(next);
    }
  }

  return history;
}
