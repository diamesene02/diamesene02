// « lib/outbox/types.ts » est une tranche de « five-scorer/lib/db.ts ».
// Ce test échoue le jour où elle a bougé — c'est-à-dire le jour où le modèle
// local du web et celui du mobile ne disent plus la même chose.
//
// Même intention que « lib/noyau/copie-conforme.test.ts », autre mécanique :
// là-bas les fichiers sont copiés en entier, ici seulement les lignes 9 à 196,
// parce que le fichier d'origine importe Dexie à sa septième ligne.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(ICI, "..", "..", "..", "five-scorer", "lib", "db.ts");
const COPIE = join(ICI, "types.ts");

const MARQUEUR = "// ——— COPIE CONFORME : five-scorer/lib/db.ts, lignes 9 à 196 ———\n";
const PREMIERE = 9;
const DERNIERE = 196;

describe("la tranche copiée de lib/db.ts", () => {
  it("est octet pour octet celle du web", () => {
    const web =
      readFileSync(SOURCE, "utf8").split("\n").slice(PREMIERE - 1, DERNIERE).join("\n") + "\n";
    const copie = readFileSync(COPIE, "utf8");
    const i = copie.indexOf(MARQUEUR);
    expect(i, "le marqueur de copie a disparu de lib/outbox/types.ts").toBeGreaterThan(-1);

    expect(
      copie.slice(i + MARQUEUR.length),
      "lib/outbox/types.ts a divergé de five-scorer/lib/db.ts. " +
        "Corriger côté web, puis recopier les lignes 9 à 196 — ne pas éditer la copie.",
    ).toBe(web);
  });

  it("commence et finit là où on croit", () => {
    // Si le fichier d'origine gagne des lignes en tête, la tranche glisse et
    // le test précédent devient illisible. Ces deux ancres disent où regarder.
    const lignes = readFileSync(SOURCE, "utf8").split("\n");
    expect(lignes[PREMIERE - 1]).toBe("export type LocalPlayer = {");
    expect(lignes[DERNIERE - 1]).toBe("};");
    expect(lignes[DERNIERE]).toBe("");
    // La ligne suivante ouvre la classe Dexie : c'est elle qui ne se porte pas.
    expect(lignes[DERNIERE + 1]).toBe("export class FiveScorerDB extends Dexie {");
  });

  it("n'emporte aucune dépendance au navigateur ni à Dexie", () => {
    // On regarde la tranche copiée, pas l'entête : celui-ci parle de Dexie
    // pour expliquer pourquoi le fichier d'origine ne se copie pas en entier.
    const copie = readFileSync(COPIE, "utf8");
    const tranche = copie.slice(copie.indexOf(MARQUEUR) + MARQUEUR.length);
    for (const interdit of ["dexie", "document.", "window.", "navigator.", "localstorage"]) {
      expect(tranche.toLowerCase().includes(interdit), `« ${interdit} » dans la tranche`).toBe(
        false,
      );
    }
  });
});
