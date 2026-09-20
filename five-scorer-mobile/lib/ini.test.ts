import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ini, lettre } from "./ini";

const ICI = dirname(fileURLToPath(import.meta.url));

/// Les initiales des avatars sont la première chose qu'on compare en posant
/// le téléphone à côté du site : « B » d'un côté, « BA » de l'autre, et tout
/// le tableau a l'air d'un autre club. La règle vit donc en COPIE du site,
/// octet pour octet, comme `calendrier.ts` — on recopie, on n'édite pas.
describe("la copie de lib/ini.ts", () => {
  it("est octet pour octet celle du site", () => {
    expect(readFileSync(join(ICI, "ini.ts"), "utf8")).toBe(
      readFileSync(join(ICI, "..", "..", "five-scorer", "lib", "ini.ts"), "utf8"),
    );
  });
});

describe("ini", () => {
  it("prend les deux premières lettres d'un nom d'un seul mot", () => {
    expect(ini("Bakary")).toBe("BA");
    expect(ini("Cédric")).toBe("CÉ");
    expect(ini("diame")).toBe("DI");
  });

  it("prend l'initiale des deux premiers mots sinon", () => {
    expect(ini("Compte de dev")).toBe("CD");
    expect(ini("  Jean   Paul  ")).toBe("JP");
  });

  it("rend « ? » pour un nom vide", () => {
    expect(ini("")).toBe("?");
    expect(ini("   ")).toBe("?");
  });
});

describe("lettre", () => {
  it("rend la première lettre du nom de chasuble", () => {
    expect(lettre("blanc")).toBe("B");
    expect(lettre("")).toBe("?");
  });
});
