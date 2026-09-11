// Quand a-t-on le droit de recharger l'app pour prendre un correctif ?
//
// La seule règle du lot, et elle tient en une phrase : **jamais pendant qu'une
// feuille est ouverte.** Recharger au milieu d'un match, ce serait perdre le
// fil de la soirée pour livrer un correctif que personne n'a demandé
// maintenant.
//
// Ce fichier ne connaît NI `expo-updates` NI React Native : il est testable
// dans un conteneur. Les appels au module natif vivent dans « appliquer.ts »,
// qui ne contient aucune règle — même découpe que « lib/plantages/ » et que
// « baseExpo.ts ».

import type { Base } from "../outbox/base";

/// Y a-t-il une feuille ouverte sur ce téléphone ?
///
/// On interroge la base, pas un écran : une feuille peut être en cours sans que
/// l'écran du match soit affiché — l'app mise en arrière-plan entre deux
/// matchs, quelqu'un qui consulte le classement pendant que ça joue.
export async function matchEnCours(base: Base): Promise<boolean> {
  const l = await base.premier("SELECT id FROM matches WHERE status = 'LIVE' LIMIT 1");
  return l !== null;
}
