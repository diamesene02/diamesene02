// Les couleurs de chasubles, et le plancher de contraste.
//
// La promesse tenue ici : quelle que soit la chasuble choisie par le club,
// l'encre dérivée porte du texte sur le fond de l'app (Lc 60) et la bande se
// détache du gazon nocturne (Lc 30). C'est testable sans écran.

import { describe, it, expect } from "vitest";
import {
  apca,
  isValidHex,
  inkVariant,
  slabVariant,
  bibTheme,
  nomChasuble,
  nomsChasubles,
  DEFAULT_BIB_A,
  DEFAULT_BIB_B,
} from "./color";

const CANVAS = "#141917"; // --pitch-1, le fond de lecture
const GAZON = "#0e1211";

describe("isValidHex", () => {
  it("accepte 3 et 6 chiffres, avec ou sans dièse", () => {
    expect(isValidHex("#FF6B2C")).toBe(true);
    expect(isValidHex("FF6B2C")).toBe(true);
    expect(isValidHex("#f60")).toBe(true);
  });

  it("refuse le reste", () => {
    expect(isValidHex("#GGGGGG")).toBe(false);
    expect(isValidHex("#FF6B2")).toBe(false);
    expect(isValidHex("orange")).toBe(false);
    expect(isValidHex("")).toBe(false);
  });
});

describe("apca", () => {
  it("le blanc sur le fond de l'app passe largement", () => {
    expect(apca("#FFFFFF", CANVAS)).toBeGreaterThan(90);
  });

  it("une couleur sur elle-même ne contraste pas", () => {
    expect(apca(CANVAS, CANVAS)).toBe(0);
  });

  it("mesure bien le problème que ce module existe pour résoudre", () => {
    // Les deux chasubles par défaut, brutes, ne portent PAS de texte.
    expect(apca(DEFAULT_BIB_A, CANVAS)).toBeLessThan(60);
    expect(apca(DEFAULT_BIB_B, CANVAS)).toBeLessThan(60);
  });
});

describe("inkVariant", () => {
  it("éclaircit jusqu'à Lc 60, pour les deux chasubles par défaut", () => {
    for (const brut of [DEFAULT_BIB_A, DEFAULT_BIB_B]) {
      const encre = inkVariant(brut);
      expect(apca(encre, CANVAS)).toBeGreaterThanOrEqual(60);
    }
  });

  it("laisse tranquille une couleur qui passe déjà", () => {
    expect(inkVariant("#FFFFFF")).toBe("#FFFFFF");
  });

  it("tient sur une chasuble marine, le cas le plus dur", () => {
    const encre = inkVariant("#001A4D");
    expect(apca(encre, CANVAS)).toBeGreaterThanOrEqual(60);
  });
});

describe("slabVariant", () => {
  it("rend visible une bande qui disparaissait sur le gazon nocturne", () => {
    const marine = "#001A4D";
    expect(apca(marine, GAZON)).toBeLessThan(30);
    expect(apca(slabVariant(marine), GAZON)).toBeGreaterThanOrEqual(30);
  });
});

describe("bibTheme", () => {
  it("retombe sur les chasubles par défaut si rien n'est choisi", () => {
    const t = bibTheme(null, undefined);
    expect(t.aFill).toBe(DEFAULT_BIB_A);
    expect(t.bFill).toBe(DEFAULT_BIB_B);
  });

  it("ignore une couleur invalide plutôt que de planter", () => {
    expect(bibTheme("pas une couleur", "#3D8BFF").aFill).toBe(DEFAULT_BIB_A);
  });

  it("normalise en majuscules, avec dièse", () => {
    expect(bibTheme("#ff6b2c", "#3d8bff").aFill).toBe("#FF6B2C");
  });

  it("les six jetons portent du texte ou se détachent, selon leur rôle", () => {
    const t = bibTheme("#001A4D", "#0B3D0B");
    expect(apca(t.aInk, CANVAS)).toBeGreaterThanOrEqual(60);
    expect(apca(t.bInk, CANVAS)).toBeGreaterThanOrEqual(60);
    expect(apca(t.aSlab, GAZON)).toBeGreaterThanOrEqual(30);
    expect(apca(t.bSlab, GAZON)).toBeGreaterThanOrEqual(30);
  });
});

describe("nomChasuble", () => {
  it("nomme les couleurs en français", () => {
    expect(nomChasuble("#FFFFFF")).toBe("Blanc");
    expect(nomChasuble("#111111")).toBe("Noir");
    expect(nomChasuble("#808080")).toBe("Gris");
    expect(nomChasuble("#FF0000")).toBe("Rouge");
    expect(nomChasuble(DEFAULT_BIB_A)).toBe("Orange");
    expect(nomChasuble(DEFAULT_BIB_B)).toBe("Bleu");
  });

  it("rend « Équipe » pour ce qui n'est pas une couleur", () => {
    expect(nomChasuble("bordeaux")).toBe("Équipe");
  });
});

describe("nomsChasubles", () => {
  it("les deux couleurs du club donnent les deux noms d'équipe", () => {
    expect(nomsChasubles("#FFFFFF", "#111111")).toEqual({
      a: "Blanc",
      b: "Noir",
    });
  });

  it("désambiguïse deux chasubles de la même famille", () => {
    expect(nomsChasubles("#FFFFFF", "#F8F8F8")).toEqual({
      a: "Blanc 1",
      b: "Blanc 2",
    });
  });
});
