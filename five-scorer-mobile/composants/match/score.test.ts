import { describe, expect, it } from "vitest";
import { largeurPeinte, tailleDuScore } from "./score";

/// Le score est la seule chose que l'affiche d'un match doit dire, et la
/// feuille en direct se lit à deux mètres. Ces mesures fixent donc un
/// CONTRAT : elles échouent si quelqu'un rend la taille flottante, si une
/// valeur devient illisible, ou si un score déborde de sa colonne.
///
/// Le 28 septembre 2026, un 18–17 s'est lu « 1… » des deux côtés : la version
/// d'avant comptait la compression `scaleX(.86)` comme un gain de place. Une
/// transformation ne change pas la mise en page — le texte garde sa pleine
/// largeur, et c'est elle qu'on mesure ici.

describe("tailleDuScore — sans largeur mesurée (premier rendu)", () => {
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

  it("compte les chiffres, pas le signe", () => {
    expect(tailleDuScore(-3, 148).fontSize).toBe(148);
  });
});

describe("tailleDuScore — avec la largeur mesurée de la colonne", () => {
  // Les colonnes réelles : ~124 pt au récap sur un iPhone de 393, ~110 sur la
  // feuille en direct. On teste aussi des colonnes bien plus étroites (petit
  // téléphone, texte en gras) : le score ne doit JAMAIS déborder tant qu'il
  // reste au-dessus du plancher de lisibilité.
  const COLONNES = [90, 100, 110, 124, 134, 160];

  it("le 18–17 de la soirée à six contre six tient dans sa colonne", () => {
    for (const col of COLONNES) {
      for (const n of [18, 17]) {
        const { fontSize } = tailleDuScore(n, 148, col);
        expect(largeurPeinte(n, fontSize)).toBeLessThanOrEqual(col - 4 + 1);
      }
    }
  });

  it("tient dans sa colonne pour tous les scores d'un five, au récap et en direct", () => {
    for (const col of COLONNES) {
      for (let n = 0; n <= 40; n++) {
        for (const base of [148, 132]) {
          const { fontSize } = tailleDuScore(n, base, col);
          const plancher = Math.round(base * 0.42);
          // Soit il tient, soit il est déjà au plancher de lisibilité.
          const tient = largeurPeinte(n, fontSize) <= col - 4 + 1;
          expect(tient || fontSize === plancher).toBe(true);
        }
      }
    }
  });

  it("ne grossit jamais au-delà de la table par nombre de chiffres", () => {
    for (const n of [0, 7, 18, 120]) {
      expect(tailleDuScore(n, 148, 400).fontSize).toBe(tailleDuScore(n, 148).fontSize);
    }
  });

  it("ne descend jamais sous le plancher de lisibilité", () => {
    for (let n = 0; n <= 120; n++) {
      expect(tailleDuScore(n, 148, 40).fontSize).toBeGreaterThanOrEqual(Math.round(148 * 0.42));
      expect(tailleDuScore(n, 132, 40).fontSize).toBeGreaterThanOrEqual(Math.round(132 * 0.42));
    }
  });

  it("une largeur nulle ou absente retombe sur la table (avant onLayout)", () => {
    expect(tailleDuScore(18, 148, 0).fontSize).toBe(104);
    expect(tailleDuScore(18, 148, undefined).fontSize).toBe(104);
  });
});

describe("tailleDuScore — mise en forme", () => {
  it("laisse de l'air au-dessus des chiffres et garde la chasse du site", () => {
    const t = tailleDuScore(7, 148);
    expect(t.lineHeight).toBeGreaterThan(t.fontSize);
    expect(t.letterSpacing).toBeCloseTo(-7.4, 1);
  });
});
