/// Le barème et l'ordre du tableau.
///
/// Ces deux fonctions vivaient au milieu de `components/Classement.tsx`. Elles
/// n'ont rien de visuel, et l'API mobile en a besoin autant que la page :
/// laissées là-bas, une route serveur aurait dû importer un composant, ses
/// liens Next et ses avatars pour trier six lignes. Une seule implémentation,
/// donc, et un seul classement.

export type LignePourClassement = {
  wins: number;
  draws: number;
  goals: number;
  name: string;
};

/// Les points d'une ligne, au barème du club.
export function points(
  r: Pick<LignePourClassement, "wins" | "draws">,
  pointsWin = 3,
  pointsDraw = 1,
): number {
  return r.wins * pointsWin + r.draws * pointsDraw;
}

/// L'ordre du tableau : points, puis victoires, puis buts, puis le nom.
///
/// Le nom en dernier n'est pas cosmétique : sans lui, deux joueurs à égalité
/// parfaite changeraient de place d'un rafraîchissement à l'autre, selon
/// l'ordre où la base a rendu les lignes.
export function trierParPoints<T extends Pick<LignePourClassement, "wins" | "draws" | "goals" | "name">>(
  lignes: T[],
  pointsWin = 3,
  pointsDraw = 1,
): T[] {
  return [...lignes].sort(
    (x, y) =>
      points(y, pointsWin, pointsDraw) - points(x, pointsWin, pointsDraw) ||
      y.wins - x.wins ||
      y.goals - x.goals ||
      x.name.localeCompare(y.name),
  );
}
