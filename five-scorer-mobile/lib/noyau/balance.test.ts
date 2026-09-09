// Le tirage de deux équipes.
//
// Trois promesses, et elles se testent toutes sans écran : les gardiens sont
// séparés, les effectifs ne diffèrent jamais de plus d'un, et le même seed
// redonne exactement le même tirage (c'est ce qui rend le bouton « re-tirer »
// honnête : seed + 1, pas un coup de dé caché).

import { describe, it, expect } from "vitest";
import { balanceTeams, type BalanceInput } from "./balance";

const joueur = (
  id: string,
  skill: number,
  isGk = false,
  form?: number,
): BalanceInput => ({ id, name: id, skill, isGk, form });

const DIX = [
  joueur("gk1", 3, true),
  joueur("gk2", 3, true),
  joueur("a", 5),
  joueur("b", 5),
  joueur("c", 4),
  joueur("d", 4),
  joueur("e", 3),
  joueur("f", 3),
  joueur("g", 2),
  joueur("h", 1),
];

const ids = (t: BalanceInput[]) => t.map((p) => p.id).sort();

describe("balanceTeams", () => {
  it("place tous les joueurs, une seule fois chacun", () => {
    const r = balanceTeams(DIX, { seed: 1 });
    expect([...ids(r.teamA), ...ids(r.teamB)].sort()).toEqual(ids(DIX));
  });

  it("sépare les deux gardiens", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = balanceTeams(DIX, { seed });
      expect(r.teamA.filter((p) => p.isGk).length).toBe(1);
      expect(r.teamB.filter((p) => p.isGk).length).toBe(1);
    }
  });

  it("ne laisse jamais plus d'un joueur d'écart entre les effectifs", () => {
    for (const n of [2, 3, 5, 7, 9, 10, 11, 14]) {
      const gens = Array.from({ length: n }, (_, i) =>
        joueur(`j${i}`, (i % 5) + 1),
      );
      const r = balanceTeams(gens, { seed: n });
      expect(Math.abs(r.teamA.length - r.teamB.length)).toBeLessThanOrEqual(1);
    }
  });

  it("le même seed redonne exactement le même tirage", () => {
    expect(balanceTeams(DIX, { seed: 7 })).toEqual(balanceTeams(DIX, { seed: 7 }));
  });

  it("des seeds différents donnent des tirages différents", () => {
    // Le bouton « re-tirer » doit vraiment re-tirer.
    const vus = new Set<string>();
    for (let seed = 1; seed <= 15; seed++) {
      vus.add(ids(balanceTeams(DIX, { seed }).teamA).join(","));
    }
    expect(vus.size).toBeGreaterThan(1);
  });

  it("équilibre : dix joueurs de même niveau donnent un écart nul", () => {
    const memes = Array.from({ length: 10 }, (_, i) => joueur(`j${i}`, 3));
    expect(balanceTeams(memes, { seed: 3 }).gap).toBe(0);
  });

  it("équilibre : l'écart reste sous un point sur un effectif réaliste", () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(balanceTeams(DIX, { seed }).gap).toBeLessThanOrEqual(1);
    }
  });

  it("la forme récente pèse la moitié d'un point de niveau", () => {
    const r = balanceTeams(
      [joueur("x", 3, false, 1), joueur("y", 3, false, -1)],
      { seed: 1 },
    );
    expect(r.strengthA + r.strengthB).toBeCloseTo(6, 10);
    expect(r.gap).toBeCloseTo(1, 10); // 3,5 contre 2,5
  });

  it("un seul joueur : pas d'équipe B", () => {
    const r = balanceTeams([joueur("seul", 4)], { seed: 1 });
    expect(r.teamA.length).toBe(1);
    expect(r.teamB).toEqual([]);
    expect(r.strengthB).toBe(0);
  });

  it("aucun joueur : ne plante pas", () => {
    const r = balanceTeams([], { seed: 1 });
    expect(r.teamA).toEqual([]);
    expect(r.teamB).toEqual([]);
    expect(r.gap).toBe(0);
  });

  it("les forces annoncées sont bien celles des équipes rendues", () => {
    const r = balanceTeams(DIX, { seed: 4 });
    const somme = (t: BalanceInput[]) =>
      t.reduce((s, p) => s + p.skill + (p.form ?? 0) * 0.5, 0);
    expect(r.strengthA).toBeCloseTo(somme(r.teamA), 10);
    expect(r.strengthB).toBeCloseTo(somme(r.teamB), 10);
    expect(r.gap).toBeCloseTo(Math.abs(r.strengthA - r.strengthB), 10);
  });
});
