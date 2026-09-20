// Ce que la carte « Ma saison » raconte (./ma-saison.ts), sur des données de
// papier. Les cas retenus sont ceux qui feraient mentir la carte le mardi
// matin : la série « sans défaite » qui répète les victoires, le palier de
// série qui compte le record au lieu de la série en cours, la barre d'une
// cote Élo qui partirait de zéro, et le bilan d'une soirée où le joueur n'a
// pas joué tous les matchs.

import { describe, it, expect } from "vitest";
import type { Badge, MatchHistorique, Serie } from "@/lib/succes";
import {
  bilanDuJoueur,
  ordinal,
  phraseBilan,
  prochainPalier,
  seriePhare,
} from "./ma-saison";

const serie = (id: Serie["id"], enCours: number, record = enCours): Serie => ({
  id,
  nom: id,
  enCours,
  record,
});

const badge = (b: Partial<Badge> & Pick<Badge, "id" | "valeur" | "prochain">): Badge => ({
  nom: "Buteur",
  icone: "ballon",
  description: "",
  paliers: [5, 10, 25, 50, 100],
  palier: 0,
  matiere: null,
  obtenuLe: null,
  matchId: null,
  rarete: null,
  ...b,
});

type MatchBilan = Parameters<typeof bilanDuJoueur>[0][number];

const but = (playerId: string, assistPlayerId: string | null = null): MatchHistorique["events"][number] => ({
  id: `e-${playerId}-${Math.random()}`,
  type: "GOAL",
  team: "A",
  playerId,
  assistPlayerId,
  minute: null,
  createdAt: new Date(0),
});

const match = (m: Partial<MatchBilan>): MatchBilan => ({
  scoreA: 0,
  scoreB: 0,
  mvpId: null,
  participants: [],
  events: [],
  ...m,
});

describe("ordinal", () => {
  it("dit 1er puis 2e", () => {
    expect(ordinal(1)).toBe("1er");
    expect(ordinal(2)).toBe("2e");
    expect(ordinal(12)).toBe("12e");
  });
});

describe("seriePhare", () => {
  it("ne retient rien en dessous du minimum de la famille", () => {
    // Deux présences d'affilée, c'est l'ordinaire d'un habitué.
    expect(seriePhare([serie("lundis", 2), serie("victoires", 1)])).toBeNull();
  });

  it("dit le record quand la série en cours l'égale", () => {
    const s = seriePhare([serie("victoires", 3, 3)]);
    expect(s).toMatchObject({ id: "victoires", titre: "3 victoires d'affilée", sous: "c'est ton record" });
  });

  it("rappelle le record quand la série en cours est en dessous", () => {
    expect(seriePhare([serie("victoires", 3, 7)])?.sous).toBe("record 7");
  });

  it("tait « sans défaite » quand il ne fait que répéter les victoires", () => {
    // 3 victoires d'affilée, donc 3 matchs sans défaite : une seule ligne.
    const s = seriePhare([serie("victoires", 3), serie("invincible", 3)]);
    expect(s?.id).toBe("victoires");
  });

  it("préfère la plus avancée par rapport au premier palier de sa famille", () => {
    // 2 victoires (premier palier à 3) contre 5 sans défaite (palier à 5) :
    // c'est l'invincibilité qui est sur le point de tomber.
    const s = seriePhare([serie("victoires", 2), serie("invincible", 5)]);
    expect(s?.id).toBe("invincible");
    expect(s?.titre).toBe("5 matchs sans défaite");
  });

  it("départage deux séries de même poids par la victoire", () => {
    const s = seriePhare([serie("victoires", 3), serie("lundis", 3)]);
    expect(s?.id).toBe("victoires");
  });
});

describe("prochainPalier", () => {
  it("ne dit rien quand tous les paliers sont pris", () => {
    expect(prochainPalier(badge({ id: "buteur", valeur: 120, prochain: null }), [])).toBeNull();
  });

  it("nomme la matière du palier visé et mesure le chemin fait", () => {
    const p = prochainPalier(badge({ id: "buteur", valeur: 7, palier: 1, prochain: 10 }), []);
    expect(p).toEqual({ titre: "Buteur argent", sous: "encore 3 buts", part: 0.7 });
  });

  it("garde le nom seul pour une famille à un seul palier", () => {
    const p = prochainPalier(
      badge({ id: "veteran", nom: "Vétéran", paliers: [3], valeur: 1, prochain: 3 }),
      [],
    );
    expect(p?.titre).toBe("Vétéran");
  });

  it("compte la série EN COURS, pas le record, pour une famille de série", () => {
    // Record de 4 matchs sans défaite, palier à 5, mais la série en cours est
    // repartie à 2 : « encore 1 » mentirait à celui qui vient de perdre.
    const p = prochainPalier(
      badge({ id: "invincible", nom: "Invincible", paliers: [5, 10, 20], valeur: 4, prochain: 5 }),
      [serie("invincible", 2, 4)],
    );
    expect(p).toEqual({
      titre: "Invincible bronze",
      sous: "encore 3 matchs sans défaite",
      part: 0.4,
    });
  });

  it("ne descend jamais sous « encore 1 » sur une série déjà au palier", () => {
    const p = prochainPalier(
      badge({ id: "serie-victoires", nom: "En feu", paliers: [3, 5], valeur: 3, prochain: 5 }),
      [serie("victoires", 5, 3)],
    );
    expect(p?.sous).toBe("encore 1 victoire d'affilée");
  });

  it("fait partir la barre d'une cote Élo de la cote de départ", () => {
    // 1 050 pour un palier à 1 100 : à moitié chemin depuis 1 000, pas à 95 %.
    const p = prochainPalier(
      badge({ id: "elo", nom: "Cote", paliers: [1100, 1200], valeur: 1050, prochain: 1100 }),
      [],
    );
    expect(p?.part).toBeCloseTo(0.5, 5);
    // Le séparateur de milliers du français change d'une version d'ICU à
    // l'autre (espace fine insécable) : on ne le fige pas.
    expect(p?.sous).toMatch(/^record 1\D?050, palier à 1\D?100$/);
  });

  it("laisse la barre à zéro sous la cote de départ", () => {
    const p = prochainPalier(
      badge({ id: "elo", nom: "Cote", paliers: [1100], valeur: 940, prochain: 1100 }),
      [],
    );
    expect(p?.part).toBe(0);
  });
});

describe("bilanDuJoueur", () => {
  const soiree: MatchBilan[] = [
    match({
      scoreA: 3,
      scoreB: 1,
      mvpId: "moi",
      participants: [
        { playerId: "moi", initialTeam: "A", isGk: false },
        { playerId: "toi", initialTeam: "B", isGk: false },
      ],
      events: [but("moi"), but("moi", "toi"), but("toi", "moi")],
    }),
    match({
      scoreA: 2,
      scoreB: 2,
      participants: [
        { playerId: "moi", initialTeam: "B", isGk: false },
        { playerId: "toi", initialTeam: "A", isGk: false },
      ],
      events: [],
    }),
    // Le troisième match de la soirée, qu'il n'a pas joué.
    match({
      scoreA: 5,
      scoreB: 0,
      participants: [{ playerId: "toi", initialTeam: "A", isGk: false }],
      events: [],
    }),
  ];

  it("ne compte que les matchs où le joueur figure", () => {
    expect(bilanDuJoueur(soiree, "moi")).toEqual({
      matchs: 2,
      v: 1,
      n: 1,
      d: 0,
      buts: 2,
      passes: 1,
      hdm: 1,
    });
  });

  it("rend null pour un joueur qui n'a pas joué de la soirée", () => {
    expect(bilanDuJoueur(soiree, "absent")).toBeNull();
  });

  it("lit le résultat du côté de son camp de départ", () => {
    expect(bilanDuJoueur(soiree, "toi")).toMatchObject({ matchs: 3, v: 1, n: 1, d: 1 });
  });
});

describe("phraseBilan", () => {
  it("énumère les résultats puis le détail", () => {
    const p = phraseBilan({ matchs: 3, v: 2, n: 1, d: 0, buts: 2, passes: 1, hdm: 1 }, true);
    expect(p.resultats).toBe("2 victoires, 1 nul");
    expect(p.detail).toBe("3 matchs · 2 buts · 1 passe · homme du match");
  });

  it("tait les passes dans un club qui ne les suit pas", () => {
    const p = phraseBilan({ matchs: 1, v: 0, n: 0, d: 1, buts: 0, passes: 2, hdm: 0 }, false);
    expect(p.resultats).toBe("1 défaite");
    expect(p.detail).toBe("1 match");
  });

  it("compte les titres d'homme du match au-delà d'un", () => {
    const p = phraseBilan({ matchs: 2, v: 2, n: 0, d: 0, buts: 0, passes: 0, hdm: 2 }, true);
    expect(p.detail).toBe("2 matchs · 2 fois homme du match");
  });
});
