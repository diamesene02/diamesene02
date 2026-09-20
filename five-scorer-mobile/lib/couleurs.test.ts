import { describe, expect, it } from "vitest";
import { arretsDeCrete, degradeDuVerre, jeton, JETONS_NEUTRES } from "./couleurs";
import { crest, themeTokens } from "./noyau/theme";

// Les jetons arrivent du serveur en chaînes CSS ; ces fonctions les relisent
// pour les moteurs de dessin du téléphone. Ce qui compte : qu'elles relisent
// EXACTEMENT ce que le site peint, pas une valeur voisine.

describe("arretsDeCrete", () => {
  it("rend les trois couleurs de crest() du site, dans l'ordre", () => {
    const [clair, milieu, sombre] = arretsDeCrete("#ff6b2c");
    expect(crest("#ff6b2c")).toBe(
      `radial-gradient(circle at 35% 30%,${clair},${milieu} 55%,${sombre})`,
    );
  });

  it("rend un aplat pour une couleur qui n'est pas hexadécimale", () => {
    expect(arretsDeCrete("rgb(1,2,3)")).toEqual(["rgb(1,2,3)", "rgb(1,2,3)", "rgb(1,2,3)"]);
  });
});

describe("degradeDuVerre", () => {
  it("lit les deux arrêts du verre sombre", () => {
    const t = themeTokens("#ff6b2c", "#2d6bff", "dark");
    expect(degradeDuVerre(t)).toEqual(["rgba(255,255,255,.11)", "rgba(255,255,255,.06)"]);
  });

  it("fait un aplat du verre clair", () => {
    const t = themeTokens("#ff6b2c", "#2d6bff", "light");
    expect(degradeDuVerre(t)).toEqual(["rgba(255,255,255,.78)", "rgba(255,255,255,.78)"]);
  });

  it("retombe sur le verre sombre sans jeton", () => {
    expect(degradeDuVerre({})).toEqual(["rgba(255,255,255,0.11)", "rgba(255,255,255,0.06)"]);
  });
});

describe("jeton", () => {
  it("préfère le jeton reçu, puis la valeur neutre", () => {
    expect(jeton({ gl: "#123" }, "gl")).toBe("#123");
    expect(jeton({}, "gl")).toBe(JETONS_NEUTRES.gl);
    expect(jeton({}, "inconnu")).toBe("transparent");
  });

  it("couvre tous les jetons que lisent les composants de base", () => {
    for (const cle of ["gl", "gb", "av", "mn", "ring", "cd", "cs", "seg", "cb", "sep"]) {
      expect(JETONS_NEUTRES[cle], cle).toBeTruthy();
    }
  });
});
