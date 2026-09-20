import { RANG_MATIERE } from "@/lib/succes-icones";
import {
  FAMILLES,
  matiereDuPalier,
  type Badge,
  type IconeSucces,
  type Matiere,
} from "@/lib/succes";

// Les succès du club vus de la page Stats : les plus rares, et le fil
// regroupé. Pur : il se teste sans base.

export type Rarete = {
  badgeId: string;
  nom: string;
  icone: IconeSucces;
  matiere: Matiere;
  /// Rang du palier le plus haut détenu dans le club.
  palier: number;
  /// « 25 buts » : ce palier-là.
  libelle: string;
  detenteurs: { playerId: string; nom: string }[];
  /// Le nombre de joueurs parmi lesquels on compte.
  total: number;
};

/// Les succès les plus rares du club, au palier le plus haut que quelqu'un y
/// détient.
///
/// La rareté du contrat (`Badge.rarete`) se lit au PREMIER palier. Dans un
/// club qui tourne depuis deux saisons, tout le monde a son « Buteur »
/// bronze ; ce qui se raconte, c'est l'or que Bakary est seul à avoir. On
/// compte donc, famille par famille, qui tient le palier le plus haut.
///
/// `joueurs` : ceux qui comptent (`SuccesClub.niveaux` — ni invités, ni
/// archivés, ni joueurs à zéro). Une famille que la moitié du club détient
/// n'est pas rare : elle n'est pas listée.
export { grouperFil, nommer, type LigneFil } from "@/lib/succes-fil";
