import type { IconeSucces, Matiere } from "../../lib/succes-icones";

// Les formes que les composants des succès LISENT — un sous-ensemble du
// contrat (lib/succes.ts : Badge, Deblocage, Niveau), les mêmes que
// five-scorer/components/succes/types.ts. Déclarées ici plutôt
// qu'importées pour que les briques ne dépendent que de ce qu'elles
// affichent : un `Badge` complet du moteur s'y passe tel quel, et un écran
// peut aussi leur donner un objet construit à la main (une démo, un test).

export type { IconeSucces, Matiere };

export type BadgeAffiche = {
  id: string;
  nom: string;
  icone: IconeSucces;
  paliers: number[];
  /// Nombre de paliers obtenus ; 0 = verrouillé.
  palier: number;
  matiere: Matiere | null;
  /// Le compteur, ou le record pour les séries et les maximums.
  valeur: number;
  prochain: number | null;
  obtenuLe: string | null;
  rarete?: number | null;
};

export type DeblocageAffiche = {
  badgeId: string;
  nom: string;
  icone: IconeSucces;
  matiere: Matiere;
  /// Rang du palier, 1 = bronze.
  palier: number;
  seuil: number;
  /// « 10 buts »
  libelle: string;
  /// ISO
  le: string;
  matchId?: string | null;
};

export type NiveauAffiche = {
  niveau: number;
  titre: string;
  xp: number;
  xpNiveau: number;
  xpSuivant: number;
  /// 0..1 vers le niveau suivant.
  progression: number;
};

/// Une ligne du fil du club : un palier franchi, et par qui.
export type ExploitAffiche = DeblocageAffiche & { playerId?: string; joueur: string };
