import type { Jetons } from "../../lib/couleurs";

// « Réduire les animations » ne vit plus ici : c'est un réglage de l'app
// entière, pas des succès. Il est dans composants/base.tsx, avec la table
// des durées — un seul abonnement au système pour tous les écrans, au lieu
// d'un par composant. Réexporté pour ne rien casser de ce qui l'importait.
export { useMouvementReduit } from "../base";

/// Les chasubles par défaut du site (lib/color.ts) : ce que montre une barre
/// quand ni les jetons du club ni ses couleurs ne sont encore là.
const DEFAUT_A = "#FF6B2C";
const DEFAUT_B = "#3D8BFF";

/// Les deux couleurs du club pour la barre et la médaille « légende ».
///
/// D'abord les anneaux (taR, tbR) : le serveur les a déjà rapprochés du
/// contraste — une chasuble noire ne disparaît pas sur la piste sombre. Puis
/// les couleurs brutes des jetons, puis celles que l'écran a sous la main
/// (`chasubles`), comme `Ecran`. Les jetons neutres n'ont rien de tout ça.
export function couleursClub(t: Jetons, chasubles?: { a: string; b: string }): { a: string; b: string } {
  return {
    a: t.taR ?? t.ta ?? chasubles?.a ?? DEFAUT_A,
    b: t.tbR ?? t.tb ?? chasubles?.b ?? DEFAUT_B,
  };
}
