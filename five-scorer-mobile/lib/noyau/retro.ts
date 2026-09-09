/// Une feuille de match saisie APRÈS COUP.
///
/// Le club joue le lundi soir ; le téléphone reste parfois dans le sac, ou
/// l'app n'est pas au rendez-vous. Les résultats existent quand même — sur
/// une capture d'écran, sur WhatsApp, dans la tête de celui qui a compté.
/// Sans porte d'entrée pour eux, une soirée entière disparaît des stats.
///
/// Un match rétro est un match normal dont `playedAt` est dans le passé. Tout
/// ce qui suit s'en déduit : il n'a pas d'horloge (donc pas de minutes sur les
/// buts), il ne se met pas en pause, et sa feuille dit « saisie » plutôt que
/// « en direct ».
///
/// Six heures : plus long qu'une soirée de five (on ouvre la feuille à 20 h,
/// on la termine à 22 h), plus court qu'une nuit. Un match ouvert la veille et
/// oublié bascule donc en rétro le lendemain — ce qui est exactement ce qu'il
/// est devenu.
export const RETRO_APRES_MS = 6 * 3600_000;

export function estRetro(playedAt: string | Date | number): boolean {
  const t =
    typeof playedAt === "number"
      ? playedAt
      : typeof playedAt === "string"
        ? Date.parse(playedAt)
        : playedAt.getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > RETRO_APRES_MS;
}
