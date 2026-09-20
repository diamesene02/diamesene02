import { describe, expect, it } from "vitest";
import { grouperFil, nommer, ordonnerBadges, proximite, sousTitreFiche } from "./affichage";
import type { Badge, Deblocage } from "../../lib/succes";

// Les règles d'affichage des succès. Elles sont pures, donc testables — et
// elles doivent rendre EXACTEMENT ce que rend le site, dont elles sont la
// copie (app/c/[slug]/players/[id]/vitrine.ts, stats/succes-club.ts).
//
// Ce fichier ne tourne pas encore avec `npm run tester` : vitest.config.mts
// ne ramasse que `lib/**` et `db/**`. Lancé à la main :
//   npx vitest run --config <config qui inclut composants/**/*.test.ts>

const badge = (b: Partial<Badge> & { id: string }): Badge => ({
  nom: b.id,
  icone: "ballon",
  description: "",
  paliers: [1],
  palier: 0,
  matiere: null,
  valeur: 0,
  prochain: 1,
  obtenuLe: null,
  matchId: null,
  rarete: null,
  ...b,
});

const MAINTENANT = new Date("2026-09-19T12:00:00.000Z");
const ilYA = (jours: number) =>
  new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString();

describe("proximite", () => {
  it("mesure une famille ordinaire sur son compteur", () => {
    expect(proximite({ id: "buteur", valeur: 5, prochain: 10 }, {}, null)).toBe(0.5);
  });

  it("mesure une série sur la série EN COURS, pas sur le record", () => {
    // Le record est 4 (valeur), mais la série en cours est cassée : on n'est
    // pas « à un pas » du palier de 5.
    const b = { id: "serie-victoires", valeur: 4, prochain: 5 };
    expect(proximite(b, { victoires: 0 }, null)).toBe(0);
    expect(proximite(b, { victoires: 4 }, null)).toBe(0.8);
  });

  it("mesure l'Élo depuis 1 000, pas depuis zéro", () => {
    expect(proximite({ id: "elo", valeur: 1050, prochain: 1100 }, {}, 1050)).toBe(0.5);
    expect(proximite({ id: "elo", valeur: 1000, prochain: 1100 }, {}, 1000)).toBe(0);
  });

  it("rend 1 quand tous les paliers sont pris", () => {
    expect(proximite({ id: "buteur", valeur: 300, prochain: null }, {}, null)).toBe(1);
  });
});

describe("ordonnerBadges", () => {
  const opts = { series: [], elo: null, maintenant: MAINTENANT };

  it("met en tête ce qui vient de tomber, le plus récent d'abord", () => {
    const liste = [
      badge({ id: "vieux", palier: 1, prochain: null, obtenuLe: ilYA(60) }),
      badge({ id: "hier", palier: 1, prochain: null, obtenuLe: ilYA(1) }),
      badge({ id: "lundi", palier: 1, prochain: null, obtenuLe: ilYA(8) }),
    ];
    expect(ordonnerBadges(liste, opts).map((b) => b.id)).toEqual(["hier", "lundi", "vieux"]);
  });

  it("classe ensuite ce qui est à portée, puis l'acquis, puis l'intouché", () => {
    const liste = [
      badge({ id: "jamais", palier: 0, valeur: 0, prochain: 5 }),
      badge({ id: "acquis", palier: 2, valeur: 30, prochain: null, obtenuLe: ilYA(90) }),
      badge({ id: "presque", palier: 0, valeur: 4, prochain: 5 }),
      badge({ id: "commence", palier: 0, valeur: 1, prochain: 5 }),
    ];
    expect(ordonnerBadges(liste, opts).map((b) => b.id)).toEqual([
      "presque",
      "commence",
      "acquis",
      "jamais",
    ]);
  });

  it("garde l'ordre du catalogue à égalité", () => {
    const liste = [badge({ id: "a" }), badge({ id: "b" }), badge({ id: "c" })];
    expect(ordonnerBadges(liste, opts).map((b) => b.id)).toEqual(["a", "b", "c"]);
  });
});

describe("grouperFil", () => {
  const d = (x: Partial<Deblocage> & { playerId: string; joueur: string }) => ({
    badgeId: "lundis-d-affilee",
    nom: "Toujours là",
    icone: "calendrier" as const,
    matiere: "bronze" as const,
    palier: 1,
    seuil: 3,
    libelle: "3 soirées d'affilée",
    le: "2026-09-15T19:00:00.000Z",
    matchId: "m1",
    ...x,
  });

  it("réunit le même palier du même jour en une ligne", () => {
    const lignes = grouperFil([
      d({ playerId: "p1", joueur: "Bakary" }),
      d({ playerId: "p2", joueur: "Cédric" }),
      d({ playerId: "p3", joueur: "Diame", le: "2026-09-08T19:00:00.000Z" }),
    ]);
    expect(lignes).toHaveLength(2);
    expect(lignes[0].joueurs.map((j) => j.nom)).toEqual(["Bakary", "Cédric"]);
    expect(lignes[1].joueurs.map((j) => j.nom)).toEqual(["Diame"]);
  });

  it("ne compte pas deux fois le même joueur", () => {
    const lignes = grouperFil([
      d({ playerId: "p1", joueur: "Bakary" }),
      d({ playerId: "p1", joueur: "Bakary" }),
    ]);
    expect(lignes[0].joueurs).toHaveLength(1);
  });

  it("sépare deux paliers différents de la même famille", () => {
    const lignes = grouperFil([
      d({ playerId: "p1", joueur: "Bakary" }),
      d({ playerId: "p2", joueur: "Cédric", palier: 2, seuil: 5 }),
    ]);
    expect(lignes).toHaveLength(2);
  });
});

describe("nommer", () => {
  it("écrit les noms comme on les dit", () => {
    expect(nommer([])).toBe("");
    expect(nommer(["Bakary"])).toBe("Bakary");
    expect(nommer(["Bakary", "Cédric"])).toBe("Bakary et Cédric");
    expect(nommer(["Bakary", "Cédric", "Diame"])).toBe("Bakary, Cédric et Diame");
    expect(nommer(["Bakary", "Cédric", "Diame", "Enzo", "Farid"])).toBe(
      "Bakary, Cédric et 3 autres",
    );
  });
});

describe("sousTitreFiche", () => {
  const niveau = { titre: "Titulaire", xp: 464 };

  it("remplace la note d'équilibrage par le titre du niveau", () => {
    expect(sousTitreFiche("Orange · Note 3 · 1er du tableau", niveau, null)).toBe(
      "Orange · Titulaire · 1er du tableau",
    );
  });

  it("accepte encore « Niveau 3 », ce que disaient les serveurs d'avant", () => {
    expect(sousTitreFiche("Orange · Niveau 3 · 1er du tableau", niveau, null)).toBe(
      "Orange · Titulaire · 1er du tableau",
    );
  });

  it("ajoute les places gagnées, jamais un zéro", () => {
    expect(sousTitreFiche("Niveau 3 · 3e du tableau", niveau, 2)).toBe(
      "Titulaire · 3e du tableau (+2)",
    );
    expect(sousTitreFiche("Niveau 3 · 3e du tableau", niveau, -1)).toBe(
      "Titulaire · 3e du tableau (−1)",
    );
    expect(sousTitreFiche("Niveau 3 · 3e du tableau", niveau, 0)).toBe(
      "Titulaire · 3e du tableau",
    );
  });

  it("retire la note quand le joueur n'a pas encore d'XP", () => {
    expect(sousTitreFiche("Blanc · Note 3 · gardien", { titre: "Recrue", xp: 0 }, null)).toBe(
      "Blanc · gardien",
    );
  });

  it("laisse le sous-titre du serveur quand les succès manquent", () => {
    expect(sousTitreFiche("Orange · Note 3 · 1er du tableau", null, 2)).toBe(
      "Orange · Note 3 · 1er du tableau",
    );
  });
});
