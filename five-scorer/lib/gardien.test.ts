// Le gardien du soir (lib/compo, `estGardienDuSoir`) : la règle que le site
// et l'app doivent dire pareil. La compo enregistrée fait foi ; le gardien
// attitré du club n'est qu'un repli, pour un joueur qu'on ajoute à l'instant.
import { describe, it, expect } from "vitest";
import { estGardienDuSoir } from "./gardien";

const attitre = { id: "antoine", isGk: true };
const champ = { id: "bakary", isGk: false };

describe("estGardienDuSoir", () => {
  it("suit la désignation de la soirée, pas le gardien attitré du club", () => {
    // Antoine (attitré) ne vient pas : le capitaine a désigné Bakary.
    const gk = estGardienDuSoir([{ playerId: "bakary", isGk: true }]);
    expect(gk(champ)).toBe(true);
  });

  it("retire les gants à l'attitré quand la compo les donne à un autre", () => {
    // Antoine est dans la compo comme joueur de champ : un enregistrement
    // depuis le site ne doit pas lui rendre les gants.
    const gk = estGardienDuSoir([
      { playerId: "antoine", isGk: false },
      { playerId: "bakary", isGk: true },
    ]);
    expect(gk(attitre)).toBe(false);
    expect(gk(champ)).toBe(true);
  });

  it("part du gardien attitré pour un joueur qu'on vient d'ajouter", () => {
    // Personne n'a de ligne de compo : Antoine garde, comme d'habitude.
    const gk = estGardienDuSoir([]);
    expect(gk(attitre)).toBe(true);
    expect(gk(champ)).toBe(false);
  });

  it("se rabat sur l'attitré tant que la compo ne désigne personne", () => {
    // Les compos déjà en base ne portent pas toutes une désignation : sans
    // ce repli, tout un club se serait retrouvé sans gardien.
    const gk = estGardienDuSoir([{ playerId: "antoine" }, { playerId: "bakary", isGk: false }]);
    expect(gk(attitre)).toBe(true);
    expect(gk(champ)).toBe(false);
  });
});
