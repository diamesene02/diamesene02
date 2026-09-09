// Le noyau porté doit rester octet pour octet identique à celui du web.
//
// Ce test n'a pas d'équivalent côté web : il existe parce que le noyau vit
// maintenant en deux exemplaires, et que deux exemplaires divergent toujours.
// Il échoue le jour où `five-scorer/lib/` bouge sans qu'on ait recopié — ce
// qui est exactement le moment où on veut le savoir.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(ICI, "..", "..", "..", "five-scorer", "lib");

const FICHIERS = [
  "clock.ts",
  "ids.ts",
  "theme.ts",
  "color.ts",
  "balance.ts",
  "retro.ts",
] as const;

describe("copie conforme du noyau", () => {
  for (const f of FICHIERS) {
    it(`${f} est identique à five-scorer/lib/${f}`, () => {
      const web = readFileSync(join(SOURCE, f));
      const mobile = readFileSync(join(ICI, f));
      // Message explicite : ce test ne se corrige pas en le modifiant.
      expect(
        mobile.equals(web),
        `lib/noyau/${f} a divergé de five-scorer/lib/${f}. ` +
          `Recopier (cp ../five-scorer/lib/${f} lib/noyau/${f}), ne pas éditer la copie.`,
      ).toBe(true);
    });
  }

  it("aucune API de navigateur dans le noyau", () => {
    for (const f of FICHIERS) {
      const code = readFileSync(join(ICI, f), "utf8");
      // Sans ces quatre-là, le fichier tourne sous React Native sans adaptation.
      for (const interdit of [
        "document.",
        "window.",
        "navigator.",
        "localStorage",
      ]) {
        expect(code.includes(interdit), `${f} utilise ${interdit}`).toBe(false);
      }
    }
  });
});
