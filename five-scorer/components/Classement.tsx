import Link from "next/link";
import AvatarAnneau from "@/components/ios/AvatarAnneau";

// Le classement, en tableau à neuf colonnes : rang, avatar, nom, MJ, V, N,
// D, B, PTS.
//
// C'était des rangées qui se dépliaient au tap pour montrer V/N/D, l'Élo et
// la forme : on payait un geste pour lire ce que tout classement de foot
// montre d'un coup. Les chiffres tabulaires tiennent sur 390 px avec les
// largeurs de colonne de la maquette (24/30/1fr/30/26/26/26/30/40), et la
// rangée entière mène à la fiche du joueur — l'Élo, les passes et les
// cartons y sont, à leur place.

export type LigneClassement = {
  playerId: string;
  name: string;
  nickname: string | null;
  photo?: string | null;
  isGuest: boolean;
  matchesPlayed: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  wins: number;
  draws: number;
  losses: number;
  winPct: number;
  mvpCount: number;
  form: ("W" | "D" | "L")[];
  streak: number;
  elo: number;
  eloTrend: number;
};

/// Les points d'une ligne : le barème du club, celui qui sert déjà au
/// championnat externe. Rendu public pour que les onglets Buteurs/Forme
/// puissent classer dans le même ordre que le tableau.
export function points(
  r: Pick<LigneClassement, "wins" | "draws">,
  pointsWin = 3,
  pointsDraw = 1,
): number {
  return r.wins * pointsWin + r.draws * pointsDraw;
}

/// L'ordre du tableau : points, puis victoires, puis buts, puis le nom.
export function trierParPoints<T extends Pick<LigneClassement, "wins" | "draws" | "goals" | "name">>(
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

export default function Classement({
  slug,
  lignes,
  /// La vitrine publique montre le même classement à des visiteurs qui n'ont
  /// pas de compte : la fiche joueur est derrière la garde du club, le lien
  /// s'efface donc au lieu de mener à une redirection.
  avecFiches = true,
  pointsWin = 3,
  pointsDraw = 1,
  /// La chasuble de chacun (celle de son dernier match) : elle colore
  /// l'anneau de l'avatar. Sans elle, l'anneau reste neutre.
  camps,
}: {
  slug: string;
  lignes: LigneClassement[];
  /// Gardés pour les appelants : les passes et les cartons ne tiennent pas
  /// dans neuf colonnes, ils se lisent sur la fiche.
  trackAssists?: boolean;
  trackCards?: boolean;
  avecFiches?: boolean;
  pointsWin?: number;
  pointsDraw?: number;
  camps?: Record<string, "A" | "B" | undefined>;
}) {
  const ordre = trierParPoints(lignes, pointsWin, pointsDraw);

  return (
    <div>
      <div className="tableau-tete" aria-hidden>
        <span />
        <span />
        <span>Joueur</span>
        <span>MJ</span>
        <span>V</span>
        <span>N</span>
        <span>D</span>
        <span>B</span>
        <span>PTS</span>
      </div>
      {ordre.map((r, i) => {
        const cellules = (
          <>
            <span>{i + 1}</span>
            <AvatarAnneau nom={r.name} photo={r.photo} camp={camps?.[r.playerId] ?? null} taille={30} />
            <span>
              {r.name}
              {r.isGuest && (
                <span className="text-[color:var(--i3)]"> (inv.)</span>
              )}
            </span>
            <span>{r.matchesPlayed}</span>
            <span>{r.wins}</span>
            <span>{r.draws}</span>
            <span>{r.losses}</span>
            <span>{r.goals}</span>
            <span>{points(r, pointsWin, pointsDraw)}</span>
          </>
        );
        return avecFiches ? (
          <Link
            key={r.playerId}
            href={`/c/${slug}/players/${r.playerId}`}
            className="tableau-rangee"
          >
            {cellules}
          </Link>
        ) : (
          <div key={r.playerId} className="tableau-rangee">
            {cellules}
          </div>
        );
      })}
    </div>
  );
}
