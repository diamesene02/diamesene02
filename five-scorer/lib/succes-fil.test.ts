import { describe, expect, it } from "vitest";
import { grouperFil, nommer } from "./succes-fil";
import type { DeblocageJoueur } from "./succes";

// Le fil des exploits : une règle, trois écrans (accueil du site, page Stats,
// accueil de l'app). Ce test est la règle — l'app recopie ces deux fonctions
// dans `composants/accueil/logique.ts` et doit rendre les mêmes phrases.

const d = (
  playerId: string,
  joueur: string,
  le: string,
  badgeId = "lundis-d-affilee",
  palier = 1,
): DeblocageJoueur => ({
  badgeId,
  nom: "Toujours là",
  icone: "calendrier",
  matiere: "bronze",
  palier,
  seuil: 3,
  libelle: "3 soirées d'affilée",
  le,
  matchId: "m1",
  playerId,
  joueur,
});

describe("nommer", () => {
  it("nomme tout le monde jusqu'à trois, puis compte", () => {
    expect(nommer([])).toBe("");
    expect(nommer(["Bakary"])).toBe("Bakary");
    expect(nommer(["Bakary", "Cédric"])).toBe("Bakary et Cédric");
    // Trois : la liste entière. C'est ce que disait la page Stats, et c'est
    // ce que l'accueil du site abrégeait en « Bakary et 2 autres ».
    expect(nommer(["Bakary", "Cédric", "Diame"])).toBe("Bakary, Cédric et Diame");
    // Quatre : deux noms et le compte des autres — jamais « et 3 autres »
    // derrière un seul nom.
    expect(nommer(["Bakary", "Cédric", "Diame", "Enzo"])).toBe(
      "Bakary, Cédric et 2 autres",
    );
  });
});

describe("grouperFil", () => {
  it("met sur une ligne le même palier franchi le même jour", () => {
    const lignes = grouperFil([
      d("p1", "Bakary", "2026-09-14T20:30:00.000Z"),
      d("p2", "Cédric", "2026-09-14T20:40:00.000Z"),
      d("p3", "Diame", "2026-09-14T21:00:00.000Z"),
    ]);
    expect(lignes).toHaveLength(1);
    expect(nommer(lignes[0].joueurs.map((j) => j.nom))).toBe(
      "Bakary, Cédric et Diame",
    );
    // Le premier du fil porte la ligne : c'est lui qui donne la date et le
    // match vers lequel elle mène.
    expect(lignes[0].d.playerId).toBe("p1");
  });

  it("sépare deux jours et deux paliers, et garde l'ordre du moteur", () => {
    const lignes = grouperFil([
      d("p1", "Bakary", "2026-09-14T20:30:00.000Z", "buteur", 2),
      d("p2", "Cédric", "2026-09-14T20:35:00.000Z", "buteur", 3),
      d("p3", "Diame", "2026-09-07T20:30:00.000Z", "buteur", 2),
    ]);
    expect(lignes.map((l) => l.joueurs.map((j) => j.nom))).toEqual([
      ["Bakary"],
      ["Cédric"],
      ["Diame"],
    ]);
  });

  it("ne nomme pas deux fois le même joueur", () => {
    const lignes = grouperFil([
      d("p1", "Bakary", "2026-09-14T20:30:00.000Z"),
      d("p1", "Bakary", "2026-09-14T21:30:00.000Z"),
    ]);
    expect(lignes).toHaveLength(1);
    expect(lignes[0].joueurs).toHaveLength(1);
  });
});
