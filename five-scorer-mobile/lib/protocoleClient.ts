// Ce que le serveur pense de notre version, et qui veut le savoir.
//
// Un module, pas un contexte React : le verdict arrive dans `lib/appel.ts`,
// c'est-à-dire en dehors de tout composant, à chaque appel. Le faire remonter
// par un contexte obligerait `creerAppel` à connaître React — alors que ce
// fichier-là est écrit exprès pour ne rien connaître d'Expo ni de React, afin
// de rester testable dans un conteneur (cf. l'en-tête de `lib/appel.ts`).
//
// Aucune bibliothèque d'état ajoutée pour ça : trois lignes d'abonnement
// suffisent, et une dépendance de plus se paie à chaque montée d'Expo SDK.

import type { VerdictProtocole } from "./protocole";

let verdict: VerdictProtocole = "ok";
const abonnes = new Set<(v: VerdictProtocole) => void>();

/// Appelé par `lib/appel.ts` à chaque réponse du serveur qui porte l'en-tête.
///
/// Ne prévient que si le verdict CHANGE : le club fait des dizaines d'appels
/// par soirée, et réveiller le bandeau à chacun ferait clignoter un écran qui
/// doit se tenir à une main.
export function definirVerdict(v: VerdictProtocole): void {
  if (v === verdict) return;
  verdict = v;
  for (const f of abonnes) f(v);
}

export function verdictActuel(): VerdictProtocole {
  return verdict;
}

export function abonnerVerdict(f: (v: VerdictProtocole) => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}
