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
/// CHIFFRES, puis se plafonne par la LARGEUR RÉELLE de la colonne, mesurée
/// (`onLayout`) par l'appelant.
///
/// Le plafond par la largeur est venu le 28 septembre 2026. Une soirée à six
/// contre six s'est jouée à 18–17 : deux chiffres à 104 points, soit ~125 de
/// large, dans une colonne de ~124 — et `numberOfLines={1}` peignait « 1… »
/// des deux côtés. Personne ne connaissait le score. La première version de
/// cette règle supposait la colonne la plus large possible et comptait la
/// compression à 86 % (`scaleX`) comme un gain de place : or une
/// transformation ne change PAS la mise en page, le texte prend sa pleine
/// largeur. Le test qui le « prouvait » mesurait la même erreur.
///
/// Module à part et sans React : c'est une règle de typographie, elle se
/// teste (score.test.ts) sans rendre un écran.

/// La largeur d'un chiffre du « score lourd » (graisse 800, chasse tabulaire),
/// en em, interlettrage compris. Mesuré à ~0,62 sur SF Pro Heavy ; on prend
/// 0,68 : mieux vaut un chiffre un peu petit qu'un chiffre coupé, et la marge
/// couvre les polices de remplacement et le réglage « texte en gras ».
export const EM_PAR_CHIFFRE = 0.68;

/// Ce qu'on ne laisse JAMAIS faire à un score : descendre sous cette part de
/// sa taille à un chiffre. Dessous, le score ne se lit plus à deux mètres ;
/// mieux vaut alors dépasser un peu de sa colonne (le texte est centré, la
/// marge d'une colonne voisine l'absorbe) que de devenir illisible.
const PLANCHER = 0.42;

export function tailleDuScore(
  valeur: number,
  /// La taille à un chiffre : 148 au récap (`.recap-chiffre`), 132 sur la
  /// feuille en direct.
  base: number,
  /// La largeur mesurée de la colonne, en points. Absente (premier rendu,
  /// avant `onLayout`) : on s'en tient à la table par nombre de chiffres.
  largeur?: number,
): { fontSize: number; lineHeight: number; letterSpacing: number } {
  const chiffres = Math.abs(Math.trunc(valeur)).toString().length;
  const parChiffres =
    chiffres <= 1 ? base : chiffres === 2 ? Math.round(base * 0.7) : Math.round(base * 0.48);
  // Quatre points de marge : le texte ne doit jamais toucher le bord de sa
  // colonne, c'est là que l'ellipse se déclenche.
  const parLargeur =
    largeur && largeur > 0
      ? Math.floor((largeur - 4) / (chiffres * EM_PAR_CHIFFRE))
      : Infinity;
  const fontSize = Math.max(Math.round(base * PLANCHER), Math.min(parChiffres, parLargeur));
  return {
    fontSize,
    // Un peu d'air au-dessus des chiffres : à l'interligne exact, iOS rogne
    // le haut des 8 et des 0.
    lineHeight: Math.round(fontSize * 1.04),
    // −0,05 em, la chasse du score lourd du site.
    letterSpacing: Math.round(-0.05 * fontSize * 10) / 10,
  };
}

/// La largeur que prend réellement un score peint : le même calcul que
/// `tailleDuScore`, vu de l'autre côté. Sert aux tests et à décider si un
/// score déborde.
export function largeurPeinte(valeur: number, fontSize: number): number {
  const chiffres = Math.abs(Math.trunc(valeur)).toString().length;
  return chiffres * fontSize * EM_PAR_CHIFFRE;
}
