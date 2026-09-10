// Le retour haptique du match.
//
// Le web appelle `navigator.vibrate(ms)` — 6 sites d'appel, trois durées : 12,
// 18 et 30 ms. `Vibration.vibrate(ms)` de React Native en est la traduction
// littérale, et c'est celle qui était en place ici. Elle a un défaut qui ne se
// voit pas dans le code : **iOS ignore la durée**. Les trois nuances y
// produisent le même buzz du vibreur, vingt-sept fois dans une soirée.
//
// `expo-haptics` n'accepte aucune durée non plus, mais il donne accès au
// Taptic Engine : trois retours distincts, courts, et qui ne se confondent pas
// avec une notification. La table de correspondance vient du §3.6 de MOBILE.md.
//
// Aucun de ces trois retours n'a été senti par une main : il n'y a pas
// d'appareil dans le nuage. Ce qui est vérifié, c'est que le bon appel part au
// bon endroit.

import * as Haptics from "expo-haptics";

/// 12 ms sur le web — le but. Le geste le plus fait de la soirée : il doit se
/// sentir sans se remarquer.
export function toucheLegere(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/// 18 ms sur le web — un carton, un joueur déplacé, un joueur qui entre. Des
/// gestes qu'on fait en regardant l'écran : `selectionAsync` est le retour de
/// « c'est pris », pas celui de « c'est arrivé ».
export function toucheChoix(): void {
  void Haptics.selectionAsync().catch(() => {});
}

/// 30 ms sur le web — une annulation, un coup de sifflet de mi-temps. Plus
/// franc que le but, exprès : ce sont les gestes qu'on ne veut pas avoir faits
/// par erreur.
export function toucheFranche(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}
