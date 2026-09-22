/// LA TAILLE D'UN SCORE, CALCULÉE PLUTÔT QUE DEVINÉE PAR UIKIT.
///
/// Le grand score du récap et celui de la feuille en direct portaient
/// `adjustsFontSizeToFit` : on laissait iOS réduire le texte jusqu'à ce qu'un
/// 12 à deux chiffres tienne dans sa colonne. Relevé au simulateur le
/// 22 septembre 2026, sur un récap ouvert après son squelette, UIKit gardait
/// un facteur de réduction d'un rendu précédent et peignait « 2 — 1 » en une
/// dizaine de points, à côté d'écussons de 76. L'affiche du match n'avait
/// plus de score, et rien dans le code ne disait pourquoi.
///
/// On ne lui demande donc plus rien. La taille se déduit du NOMBRE DE
/// CHIFFRES, qui est la seule chose dont elle dépendait : un chiffre garde la
/// valeur du site, deux la ramènent à 70 %, trois à 48 %. Ce sont à chaque
/// fois les plus grandes valeurs qui tiennent dans la colonne la plus étroite
/// — 134 points sur un iPhone de 393, chasse du « score lourd » comprise
/// (0,6 em par chiffre), compression à 86 % comprise.
///
/// Module à part et sans React : c'est une règle de typographie, elle se
/// teste (score.test.ts) sans rendre un écran.
export function tailleDuScore(
  valeur: number,
  /// La taille à un chiffre : 148 au récap (`.recap-chiffre`), 132 sur la
  /// feuille en direct.
  base: number,
): { fontSize: number; lineHeight: number; letterSpacing: number } {
  const chiffres = Math.abs(Math.trunc(valeur)).toString().length;
  const fontSize =
    chiffres <= 1 ? base : chiffres === 2 ? Math.round(base * 0.7) : Math.round(base * 0.48);
  return {
    fontSize,
    // Un peu d'air au-dessus des chiffres : à l'interligne exact, iOS rogne
    // le haut des 8 et des 0.
    lineHeight: Math.round(fontSize * 1.04),
    // −0,05 em, la chasse du score lourd du site.
    letterSpacing: Math.round(-0.05 * fontSize * 10) / 10,
  };
}
