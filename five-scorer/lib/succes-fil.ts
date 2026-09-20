import { cleJour } from "@/lib/jour";
import type { DeblocageJoueur } from "@/lib/succes";

// Le fil des exploits, mis en lignes : le regroupement et les noms.
//
// Trois écrans le montrent — l'accueil du site, la page Stats du site,
// l'accueil de l'app —, et il n'y a qu'une façon de le dire. Il vivait
// jusqu'ici dans `app/c/[slug]/stats/succes-club.ts`, recopié dans
// `ExploitsDuClub.tsx` avec une règle de nommage différente : le même soir,
// l'accueil disait « Bakary et 2 autres » quand la page Stats disait
// « Bakary, Cédric et Diame ». Posé dans `lib/`, c'est aussi le seul endroit
// d'où un test peut le lire (vitest ne ramasse que `lib/**/*.test.ts`) — la
// copie de l'app (`composants/accueil/logique.ts`) se règle sur celui-ci.
//
// Pur : ni Prisma, ni `server-only`. `lib/jour.ts` et pas `lib/dates.ts`,
// pour la même raison.

export type LigneFil = {
  /// `badgeId:palier:jour` — ce qui fait qu'un palier tient sur une ligne.
  cle: string;
  /// Le premier déblocage du groupe : le palier, la date, le match.
  d: DeblocageJoueur;
  joueurs: { playerId: string; nom: string }[];
};

/// Le fil, un palier par ligne plutôt qu'un joueur par ligne.
///
/// Le premier soir d'une saison, dix joueurs franchissent « Toujours là » au
/// même match : dix lignes identiques, et le triplé de la soirée tombait
/// hors du fil. Le même palier, le même jour, fait une seule ligne qui nomme
/// tout le monde. L'ordre du moteur (le plus récent d'abord) est gardé.
export function grouperFil(fil: readonly DeblocageJoueur[]): LigneFil[] {
  const lignes: LigneFil[] = [];
  const index = new Map<string, LigneFil>();
  for (const d of fil) {
    const cle = `${d.badgeId}:${d.palier}:${cleJour(new Date(d.le))}`;
    const l = index.get(cle);
    if (l) {
      if (!l.joueurs.some((j) => j.playerId === d.playerId)) {
        l.joueurs.push({ playerId: d.playerId, nom: d.joueur });
      }
      continue;
    }
    const nouvelle = { cle, d, joueurs: [{ playerId: d.playerId, nom: d.joueur }] };
    index.set(cle, nouvelle);
    lignes.push(nouvelle);
  }
  return lignes;
}

/// « Bakary », « Bakary et Cédric », « Bakary, Cédric et Diame »,
/// « Bakary, Cédric et 3 autres ».
export function nommer(noms: readonly string[]): string {
  if (noms.length <= 1) return noms[0] ?? "";
  if (noms.length <= 3) return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
  return `${noms[0]}, ${noms[1]} et ${noms.length - 2} autres`;
}
