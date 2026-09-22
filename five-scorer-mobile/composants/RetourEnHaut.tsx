import { useEffect, useRef } from "react";
import type { ScrollView } from "react-native";

/// Retaper l'onglet où l'on est déjà remonte la page.
///
/// C'est le geste que tout le monde fait sur un téléphone, et il ne faisait
/// rien : `navigate` vers l'écran courant est un non-événement. Or les deux
/// écrans que l'on tape le plus sont aussi les plus longs — les stats d'un
/// club de vingt joueurs, l'historique des matchs d'une saison entière — et
/// on y descend loin. Revenir en haut demandait quatre ou cinq balayages
/// (iOS sait le faire en tapant la barre d'état, mais personne ne le sait).
///
/// Un registre de trois lignes plutôt qu'un contexte React : les écrans
/// d'onglet restent TOUS montés (le layout est un `Tabs`), ils s'inscrivent
/// une fois chacun sous leur nom de route, et la barre appelle par ce nom.
/// Aucun nouveau paquet : `useScrollToTop` vit dans
/// `@react-navigation/native`, qui n'est ici qu'une dépendance indirecte —
/// l'app se livre par mise à jour à chaud, on n'ajoute rien à package.json.
const sommets = new Map<string, () => void>();

/// À poser sur la `ScrollView` de l'écran : `ref={useSommet("matchs")}`.
/// Le nom est celui de la route dans le `Tabs` (« index », « matchs », …).
export function useSommet(nom: string) {
  const ref = useRef<ScrollView | null>(null);
  useEffect(() => {
    const remonter = () => ref.current?.scrollTo({ y: 0, animated: true });
    sommets.set(nom, remonter);
    return () => {
      // Seulement si c'est encore la nôtre : deux montages qui se croisent
      // (un changement de club) effaceraient sinon l'inscription du neuf.
      if (sommets.get(nom) === remonter) sommets.delete(nom);
    };
  }, [nom]);
  return ref;
}

/// Remonte l'écran s'il s'est inscrit. Rend `false` sinon — à l'appelant de
/// faire autre chose (naviguer, par exemple).
export function remonterVers(nom: string): boolean {
  const remonter = sommets.get(nom);
  if (!remonter) return false;
  remonter();
  return true;
}
