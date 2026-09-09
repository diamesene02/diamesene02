// Les 30 jetons du thème, dérivés des deux chasubles.
//
// Ce que ces tests protègent : un club en noir et blanc doit voir SES DEUX
// équipes dans les listes. L'anneau d'avatar porte la couleur brute de la
// chasuble ; sans rattrapage, la chasuble noire disparaît en thème sombre et
// la blanche en thème clair, et le classement n'a plus qu'une équipe visible
// sur deux.

import { describe, it, expect } from "vitest";
import {
  mix,
  rgba,
  lum,
  crest,
  normaliseCouleur,
  themeTokens,
  themeVars,
  parseTheme,
  THEME_COOKIE,
} from "./theme";
import { DEFAULT_BIB_A, DEFAULT_BIB_B, apca } from "./color";

describe("mix", () => {
  it("mélange linéairement vers la seconde couleur", () => {
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("accepte la notation à 3 chiffres", () => {
    expect(mix("#000", "#fff", 1)).toBe("#ffffff");
  });
});

describe("rgba / lum", () => {
  it("rgba rend la notation CSS attendue", () => {
    expect(rgba("#FF6B2C", 0.34)).toBe("rgba(255,107,44,0.34)");
  });

  it("lum va de 0 à 1", () => {
    expect(lum("#000000")).toBe(0);
    expect(lum("#ffffff")).toBe(1);
    expect(lum("#111111")).toBeLessThan(0.16);
  });
});

describe("normaliseCouleur", () => {
  it("retombe sur le repli quand la couleur est absente ou invalide", () => {
    expect(normaliseCouleur(null, DEFAULT_BIB_A)).toBe(DEFAULT_BIB_A);
    expect(normaliseCouleur(undefined, DEFAULT_BIB_A)).toBe(DEFAULT_BIB_A);
    expect(normaliseCouleur("bordeaux", DEFAULT_BIB_A)).toBe(DEFAULT_BIB_A);
  });

  it("développe la notation à 3 chiffres", () => {
    expect(normaliseCouleur("#f60", DEFAULT_BIB_A)).toBe("#ff6600");
  });
});

describe("crest", () => {
  it("est un dégradé radial — la forme que React Native ne sait pas lire nativement", () => {
    // Rappel pour le portage : côté natif, c'est <RadialGradient> de
    // react-native-svg qui rendra cette chaîne (§3.5 de MOBILE.md).
    expect(crest("#FF6B2C")).toMatch(/^radial-gradient\(circle at 35% 30%,/);
  });
});

describe("themeTokens", () => {
  it("rend les mêmes clés en sombre et en clair", () => {
    const sombre = Object.keys(themeTokens("#FFFFFF", "#111111", "dark")).sort();
    const clair = Object.keys(themeTokens("#FFFFFF", "#111111", "light")).sort();
    expect(sombre).toEqual(clair);
    expect(sombre.length).toBeGreaterThanOrEqual(30);
  });

  it("porte les deux couleurs du club, normalisées", () => {
    const v = themeTokens("#FF6B2C", "#3D8BFF", "dark");
    expect(v.ta).toBe("#ff6b2c");
    expect(v.tb).toBe("#3d8bff");
  });

  it("une chasuble NOIRE reste visible en thème sombre", () => {
    const v = themeTokens("#FFFFFF", "#111111", "dark");
    expect(v.tbR).not.toBe("#111111");
    expect(lum(v.tbR)).toBeGreaterThan(lum("#111111"));
  });

  it("une chasuble BLANCHE reste visible en thème clair", () => {
    const v = themeTokens("#FFFFFF", "#111111", "light");
    expect(v.taR).not.toBe("#ffffff");
    expect(lum(v.taR)).toBeLessThan(lum("#ffffff"));
  });

  it("l'encre posée sur l'écusson est lisible dans les deux sens", () => {
    const v = themeTokens("#FFFFFF", "#111111", "dark");
    expect(v.taF).toBe("#111"); // texte sombre sur chasuble blanche
    expect(v.tbF).toBe("#fff"); // texte clair sur chasuble noire
  });

  it("l'encre d'équipe atteint Lc 60 en thème sombre", () => {
    // Le plancher de contraste du §3.5, sur les chasubles par défaut.
    const v = themeTokens(DEFAULT_BIB_A, DEFAULT_BIB_B, "dark");
    expect(apca(v.taInk, mix(DEFAULT_BIB_A, "#000000", 0.66))).toBeGreaterThanOrEqual(60);
    expect(apca(v.tbInk, mix(DEFAULT_BIB_B, "#000000", 0.8))).toBeGreaterThanOrEqual(60);
  });

  it("le fond uni du thème sombre est bien sombre", () => {
    const v = themeTokens("#FF6B2C", "#3D8BFF", "dark");
    expect(lum(v.bgSolid)).toBeLessThan(0.3);
    expect(themeTokens("#FF6B2C", "#3D8BFF", "light").bgSolid).toBe("#f2f2f7");
  });
});

describe("themeVars", () => {
  it("sérialise les jetons en déclaration CSS", () => {
    const css = themeVars("#FF6B2C", "#3D8BFF", "dark");
    expect(css).toContain("--ta:#ff6b2c");
    expect(css).toContain("--tb:#3d8bff");
    expect(css.split(";").length).toBe(
      Object.keys(themeTokens("#FF6B2C", "#3D8BFF", "dark")).length,
    );
  });
});

describe("parseTheme", () => {
  it("sombre par défaut, clair seulement si demandé", () => {
    expect(parseTheme(undefined)).toBe("dark");
    expect(parseTheme(null)).toBe("dark");
    expect(parseTheme("nimportequoi")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(THEME_COOKIE).toBe("fs-theme");
  });
});
