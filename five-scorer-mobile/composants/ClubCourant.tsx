import { createContext, useContext, useSyncExternalStore } from "react";
import { chargerMoi, type ClubDeMoi, type Moi } from "../lib/api";

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

// --- Le dernier « moi » reçu ------------------------------------------------
//
// Chaque écran du club demande `/api/me` pour connaître ses couleurs, et
// affiche en attendant un fond gris neutre : ouvrir « Soirées » depuis le
// menu faisait passer l'écran du gris au dégradé du club, à chaque fois.
// Le layout du club le demande déjà à chaque retour ; on garde la réponse
// ici, en mémoire, pour que l'écran suivant naisse aux bonnes couleurs et
// que la pilule sache le nom de l'utilisateur et le nombre de ses clubs.
//
// En mémoire seulement : au lancement suivant, la première réponse la
// remplit. Pas de copie sur le disque qui survivrait à une déconnexion.

let dernierMoi: Moi | null = null;
const abonnes = new Set<() => void>();

function abonner(f: () => void): () => void {
  abonnes.add(f);
  return () => void abonnes.delete(f);
}

/// Range la dernière réponse de `/api/me`.
export function memoriserMoi(moi: Moi | null): void {
  dernierMoi = moi;
  for (const f of abonnes) f();
}

/// `chargerMoi()`, qui range sa réponse au passage. À préférer dans les
/// écrans : la pilule et les autres écrans en profitent.
export async function chargerMoiMemorise(): Promise<Moi> {
  const moi = await chargerMoi();
  memoriserMoi(moi);
  return moi;
}

/// La dernière réponse de `/api/me`, ou `null` si on n'en a pas encore.
export function useMoiMemorise(): Moi | null {
  return useSyncExternalStore(abonner, () => dernierMoi);
}

/// Le club tel que `/api/me` l'a décrit la dernière fois — ses couleurs, ses
/// jetons, ses droits. Par défaut celui de la route du layout ; `clubId`
/// pour un écran hors du layout (soirée, fiche joueur, récap).
///
/// Pour la valeur initiale d'un écran :
///   const memo = useClubMemorise(id);
///   const t = club?.theme.sombre ?? memo?.theme.sombre ?? JETONS_NEUTRES;
export function useClubMemorise(clubId?: string | null): ClubDeMoi | null {
  const moi = useMoiMemorise();
  const duLayout = useClubId();
  const cible = clubId || duLayout;
  if (!moi || !cible) return null;
  return moi.clubs.find((c) => c.id === cible) ?? null;
}
