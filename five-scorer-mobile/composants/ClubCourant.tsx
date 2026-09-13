import { createContext, useContext } from "react";

/// L'identifiant du club de l'onglet courant.
///
/// **Pourquoi ce contexte existe**, et il vaut d'être lu avant d'y toucher :
///
/// Les écrans d'onglet (`app/club/[id]/soirees.tsx` et ses cinq voisins) ne
/// peuvent PAS lire `[id]` eux-mêmes. Le segment dynamique appartient au
/// layout, pas à la feuille : `useLocalSearchParams` y rend un objet vide, et
/// l'écran reste sur « On va chercher… » indéfiniment.
///
/// D'où l'emploi initial de `useGlobalSearchParams` — qui, lui, rend les
/// paramètres de la route FOCALISÉE. Ça marchait tant qu'on restait dans les
/// onglets, et ça cassait dès qu'on ouvrait une fiche de soirée : la route
/// `/soiree/[id]` a un paramètre `id` elle aussi, donc au retour les six
/// écrans du club appelaient `/api/clubs/<id-de-soirée>/…` et prenaient un 404
/// (vu en production les 12 et 13 septembre 2026).
///
/// Les deux hooks sont donc faux ici, pour deux raisons opposées. Le layout,
/// lui, est à la bonne hauteur : `[id]` EST son segment. Il le lit une fois et
/// le descend par ce contexte — stable, et insensible à ce qui est affiché
/// par-dessus.
const ContexteClub = createContext<string | undefined>(undefined);

export const FournisseurClub = ContexteClub.Provider;

/// L'identifiant du club, tel que la route du layout le porte.
///
/// Rend une chaîne vide hors du fournisseur plutôt que de lever : les six
/// écrans gardent déjà `if (!id) return`, et faire planter l'app pour une
/// erreur de câblage serait pire que l'écran d'attente qu'ils affichent.
export function useClubId(): string {
  return useContext(ContexteClub) ?? "";
}
