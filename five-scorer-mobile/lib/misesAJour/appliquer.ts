// La mise à jour à chaud, appliquée au bon moment.
//
// Pourquoi ce fichier existe : `expo-updates` configuré et jamais APPELÉ se
// comporte selon son défaut — il sonde au lancement, télécharge en arrière-plan,
// et **applique au démarrage SUIVANT**. Pour ce club, ça vide la promesse du
// lot : celui qui ouvre l'app à 19 h 55 en arrivant au gymnase jouerait toute
// la soirée avec l'ancien code, et le correctif du dimanche n'arriverait que
// lundi prochain.
//
// Aucune règle ici, seulement des appels : la seule décision du lot est dans
// « regle.ts », et elle est testée.

import * as Updates from "expo-updates";
import type { Base } from "../outbox/base";
import { matchEnCours } from "./regle";

/// Cherche un correctif et l'applique — au démarrage, et seulement là.
///
/// **Trois refus, et aucun n'est négociable :**
///
///   - `Updates.isEnabled` est faux en développement et dans Expo Go : on ne
///     fait rien, sans quoi chaque rechargement à chaud partirait en sonde ;
///   - **une feuille est ouverte** : le correctif attendra le prochain
///     démarrage, c'est-à-dire le comportement par défaut — et c'est très bien
///     ainsi (constitution, article I) ;
///   - pas de réseau, ou rien de neuf : on passe.
///
/// N'échoue jamais bruyamment : une mise à jour qui ne se fait pas ne doit pas
/// empêcher l'app de démarrer.
export async function appliquerMiseAJour(base: Base): Promise<void> {
  if (!Updates.isEnabled) return;
  try {
    if (await matchEnCours(base)) return;

    const dispo = await Updates.checkForUpdateAsync();
    if (!dispo.isAvailable) return;

    await Updates.fetchUpdateAsync();

    // Une dernière fois avant de recharger : entre la sonde et le
    // téléchargement, quelqu'un a pu lancer un match depuis l'accueil.
    if (await matchEnCours(base)) return;

    await Updates.reloadAsync();
  } catch {
    // avalée : le correctif arrivera au démarrage suivant, par le chemin par
    // défaut. Rien de ce que fait ce fichier ne vaut d'empêcher l'app de
    // s'ouvrir.
  }
}
