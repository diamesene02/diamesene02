import { describe, expect, it } from "vitest";
import { tailleDuScore } from "./score";

/// Le score est la seule chose que l'affiche d'un match doit dire, et la
/// feuille en direct se lit à deux mètres. Ces mesures fixent donc un
/// CONTRAT : elles échouent si quelqu'un rend la taille flottante, ou si une
/// valeur descend sous ce que la colonne peut porter.
///
/// La colonne la plus étroite mesurée : 134 points au récap (iPhone de 393,
/// marges 24, milieu 86), 110 sur la feuille en direct (marges 20, milieu
/// 132). La chasse du « score lourd » est d'environ 0,6 em par chiffre,
/// moins 0,05 em d'interlettrage, le tout compressé à 86 % au récap.
const LARGEUR_RECAP = 134;
const LARGEUR_FEUILLE = 110;

/// La largeur peinte par un score, aux mesures du site.
function largeur(valeur: number, base: number, compresse: boolean): number {
  const { fontSize, letterSpacing } = tailleDuScore(valeur, base);
  const chiffres = Math.abs(Math.trunc(valeur)).toString().length;
  const brut = chiffres * (fontSize * 0.6 + letterSpacing);
  return compresse ? brut * 0.86 : brut;
}

describe("tailleDuScore", () => {
  it("garde la taille du site quand il n'y a qu'un chiffre", () => {
    expect(tailleDuScore(0, 148).fontSize).toBe(148);
    expect(tailleDuScore(9, 148).fontSize).toBe(148);
    expect(tailleDuScore(0, 132).fontSize).toBe(132);
  });

  it("réduit à deux chiffres, puis à trois", () => {
    expect(tailleDuScore(10, 148).fontSize).toBe(104);
    expect(tailleDuScore(99, 148).fontSize).toBe(104);
    expect(tailleDuScore(100, 148).fontSize).toBe(71);
  });

  it("ne rend JAMAIS une taille minuscule — c'est tout le bug qu'on répare", () => {
    // UIKit peignait « 2 » en une dizaine de points. Quel que soit le score
    // d'un five, le chiffre reste lisible à deux mètres.
    for (let n = 0; n <= 30; n++) {
      expect(tailleDuScore(n, 148).fontSize).toBeGreaterThanOrEqual(70);
      expect(tailleDuScore(n, 132).fontSize).toBeGreaterThanOrEqual(62);
    }
  });

  it("tient dans sa colonne, au récap comme sur la feuille", () => {
    for (const n of [0, 5, 9, 10, 12, 27, 99, 100]) {
      expect(largeur(n, 148, true)).toBeLessThanOrEqual(LARGEUR_RECAP);
      expect(largeur(n, 132, false)).toBeLessThanOrEqual(LARGEUR_FEUILLE);
    }
  });

  it("laisse de l'air au-dessus des chiffres et garde la chasse du site", () => {
    const t = tailleDuScore(7, 148);
    expect(t.lineHeight).toBeGreaterThan(t.fontSize);
    expect(t.letterSpacing).toBeCloseTo(-7.4, 1);
  });

  it("compte les chiffres, pas le signe ni les décimales", () => {
    expect(tailleDuScore(-3, 148).fontSize).toBe(148);
  });
});
