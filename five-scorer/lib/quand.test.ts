// « Dans 2 jours » et la date proposée pour une nouvelle soirée.
//
// Les cas qui comptent sont ceux de la borne : 23 h 30 un samedi n'est pas
// « la veille » du lundi, et le changement d'heure ne doit pas décaler la
// soirée de 19 h à 18 h ou 20 h.

import { describe, it, expect } from "vitest";
import { ecartJours, prochaineDateDeJeu, quandRelatif } from "./quand";

const t = (s: string) => new Date(s);

describe("quandRelatif", () => {
  // Samedi 19 septembre 2026, midi à Paris.
  const samedi = t("2026-09-19T10:00:00Z");

  it("dit le soir même, le lendemain, puis compte les jours", () => {
    expect(quandRelatif(t("2026-09-19T17:00:00Z"), samedi)).toBe("Ce soir");
    expect(quandRelatif(t("2026-09-19T08:00:00Z"), samedi)).toBe("Aujourd'hui");
    expect(quandRelatif(t("2026-09-20T17:00:00Z"), samedi)).toBe("Demain");
    expect(quandRelatif(t("2026-09-21T17:00:00Z"), samedi)).toBe("Dans 2 jours");
    expect(quandRelatif(t("2026-09-25T17:00:00Z"), samedi)).toBe("Dans 6 jours");
  });

  it("se tait au-delà d'une semaine et avant-hier", () => {
    expect(quandRelatif(t("2026-09-26T17:00:00Z"), samedi)).toBeNull();
    expect(quandRelatif(t("2026-09-18T17:00:00Z"), samedi)).toBe("Hier");
    expect(quandRelatif(t("2026-09-17T17:00:00Z"), samedi)).toBeNull();
  });

  it("compte en jours civils de Paris, pas en tranches de 24 h", () => {
    // Samedi 23:30 à Paris (21:30 UTC) : lundi 19 h est dans 2 jours,
    // alors qu'il reste moins de 44 heures.
    const tard = t("2026-09-19T21:30:00Z");
    expect(ecartJours(t("2026-09-21T17:00:00Z"), tard)).toBe(2);
    // Dimanche 00:30 à Paris (22:30 UTC samedi) : c'est demain.
    const apresMinuit = t("2026-09-19T22:30:00Z");
    expect(quandRelatif(t("2026-09-21T17:00:00Z"), apresMinuit)).toBe("Demain");
  });
});

describe("prochaineDateDeJeu", () => {
  // Lundi 14 septembre 2026, 19:00 à Paris.
  const lundi19h = t("2026-09-14T17:00:00Z");

  it("propose le prochain jour de jeu, à l'heure habituelle", () => {
    const d = prochaineDateDeJeu({
      modele: lundi19h,
      prises: [],
      maintenant: t("2026-09-19T10:00:00Z"),
    });
    expect(d.toISOString()).toBe("2026-09-21T17:00:00.000Z");
  });

  it("saute les jours qui ont déjà leur soirée", () => {
    const d = prochaineDateDeJeu({
      modele: lundi19h,
      prises: ["2026-09-21", "2026-09-28"],
      maintenant: t("2026-09-19T10:00:00Z"),
    });
    expect(d.toISOString()).toBe("2026-10-05T17:00:00.000Z");
  });

  it("ne propose pas une heure déjà passée", () => {
    // Lundi 21, 20:00 à Paris : la soirée de 19 h est derrière nous.
    const d = prochaineDateDeJeu({
      modele: lundi19h,
      prises: [],
      maintenant: t("2026-09-21T18:00:00Z"),
    });
    expect(d.toISOString()).toBe("2026-09-28T17:00:00.000Z");
  });

  it("garde 19 h de l'autre côté du changement d'heure", () => {
    // Le 25 octobre 2026, Paris repasse à UTC+1 : 19 h = 18:00 UTC.
    const d = prochaineDateDeJeu({
      modele: lundi19h,
      prises: [],
      maintenant: t("2026-10-20T10:00:00Z"),
    });
    expect(d.toISOString()).toBe("2026-10-26T18:00:00.000Z");
  });

  it("sans soirée modèle, propose demain 19 h", () => {
    const d = prochaineDateDeJeu({
      modele: null,
      prises: [],
      maintenant: t("2026-09-19T10:00:00Z"),
    });
    expect(d.toISOString()).toBe("2026-09-20T17:00:00.000Z");
  });
});
