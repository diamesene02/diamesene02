// Le retour haptique des gestes HORS de la feuille de match.
//
// La feuille a le sien, `lib/vibrer.ts`, calé sur les trois durées du site
// (but, carton, annulation). Ici, ce sont les autres gestes de la soirée :
// placer un joueur dans une équipe, répondre présent, enregistrer la compo,
// ouvrir le menu. Ils n'ont pas d'équivalent sur le site — un navigateur ne
// touche pas le Taptic Engine — et c'est justement ce que le téléphone ajoute.
//
// Quatre retours, pas plus. Au-delà on ne les distingue plus au doigt, et un
// retour qu'on ne reconnaît pas n'informe de rien.
//
// **Toujours silencieux en cas d'échec.** Un Android sans vibreur, un
// simulateur, le mode économie d'énergie : aucun de ces cas ne doit faire
// échouer le geste qui l'a demandé. D'où le `try` en plus du `.catch` — un
// module absent lève AVANT de rendre sa promesse.

import * as Haptics from "expo-haptics";

function sansBruit(appel: () => Promise<void>): void {
  try {
    void appel().catch(() => {});
  } catch {
    /* pas de moteur haptique ici : on se tait */
  }
}

/// Un contact bref : ouvrir un menu, toucher une pilule. Le geste le plus
/// fréquent, qui doit se sentir sans se remarquer.
export function leger(): void {
  sansBruit(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/// « C'est pris » : un joueur change d'équipe, un segment bascule, un
/// interrupteur change d'état. Le retour d'une sélection, pas d'une action.
export function choix(): void {
  sansBruit(() => Haptics.selectionAsync());
}

/// Une action qui a ABOUTI côté serveur ou dans la base : compo enregistrée,
/// réponse envoyée, match terminé. À appeler après l'`await`, jamais avant —
/// un succès annoncé puis démenti par un message d'erreur est pire que rien.
export function succes(): void {
  sansBruit(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/// Un geste qui demande de regarder l'écran : l'avertissement avant de
/// jeter une compo, un envoi refusé.
export function avertissement(): void {
  sansBruit(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
