import { describe, it, expect } from "vitest";
import { ajouter, construirePlantage, ecrire, relire, GARDES } from "./contrat";

const quand = "2026-09-11T20:00:00.000Z";

describe("construire un plantage", () => {
  it("garde le message et coupe la pile", () => {
    const e = new Error("ça a cassé");
    e.stack = Array.from({ length: 40 }, (_, i) => `  at cadre${i}`).join("\n");
    const p = construirePlantage(e, "la feuille de match", quand);
    expect(p.message).toBe("ça a cassé");
    expect(p.ou).toBe("la feuille de match");
    expect(p.pile!.split("\n")).toHaveLength(8);
  });

  it("survit à ce qui n'est pas une Error", () => {
    const p = construirePlantage("juste une chaîne", "ailleurs", quand);
    expect(p.message).toBe("juste une chaîne");
    expect(p.pile).toBeNull();
  });
});

describe("la liste bornée", () => {
  it("garde le plus récent en premier", () => {
    const a = construirePlantage(new Error("a"), "x", quand);
    const b = construirePlantage(new Error("b"), "x", quand);
    expect(ajouter([a], b).map((p) => p.message)).toEqual(["b", "a"]);
  });

  it(`ne dépasse jamais ${GARDES}`, () => {
    let liste = [] as ReturnType<typeof construirePlantage>[];
    for (let i = 0; i < GARDES + 15; i++) {
      liste = ajouter(liste, construirePlantage(new Error(`n${i}`), "x", quand));
    }
    expect(liste).toHaveLength(GARDES);
    // Le plus récent est bien en tête, et le plus ancien est bien tombé.
    expect(liste[0].message).toBe(`n${GARDES + 14}`);
    expect(liste.some((p) => p.message === "n0")).toBe(false);
  });
});

describe("relire un fichier", () => {
  it("fait l'aller-retour sans rien perdre", () => {
    const liste = [
      construirePlantage(new Error("un"), "x", quand),
      construirePlantage(new Error("deux"), "y", quand),
    ];
    expect(relire(ecrire(liste))).toEqual(liste);
  });

  it("ignore une ligne abîmée au lieu de tout perdre", () => {
    // Le cas réel : une coupure d'écriture laisse la dernière ligne tronquée.
    // C'est précisément le moment où l'on vient lire ce fichier.
    const bon = construirePlantage(new Error("lisible"), "x", quand);
    const texte = ecrire([bon]) + '{"quand":"2026-09-11T20:0';
    expect(relire(texte)).toEqual([bon]);
  });

  it("rend une liste vide sur un fichier vide", () => {
    expect(relire("")).toEqual([]);
  });
});
