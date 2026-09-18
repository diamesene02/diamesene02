// Le jour du club — la borne sur laquelle repose tout le lot 0007.
//
// Ces cas ne sont pas décoratifs : le changement d'heure est le bug que
// `lib/dates.ts` raconte avoir payé (une soirée de 19 h annoncée à 17 h), et
// la borne de minuit est ce qui distingue « un match du lundi » d'« un match
// du mardi » pour un gymnase qui ferme à 23 h.
//
// Aucune base, aucun réseau : `lib/jour.ts` ne contient que de l'Intl.

import { describe, it, expect } from "vitest";
import { FUSEAU, cleJour, minuit, fenetreDuJour, memeJour } from "./jour";

const paris = (s: string) => new Date(s);

describe("cleJour", () => {
  it("rend le jour civil de Paris, pas celui d'UTC", () => {
    // 21:30 UTC un 14 septembre = 23:30 à Paris, toujours le 14.
    expect(cleJour(paris("2026-09-14T21:30:00Z"))).toBe("2026-09-14");
    // 22:30 UTC = 00:30 à Paris, on est le 15.
    expect(cleJour(paris("2026-09-14T22:30:00Z"))).toBe("2026-09-15");
  });

  it("tient des deux côtés du changement d'heure", () => {
    // Dernier dimanche d'octobre 2026 : on repasse à GMT+1 le 25.
    expect(cleJour(paris("2026-10-24T23:30:00Z"))).toBe("2026-10-25"); // +2 encore
    expect(cleJour(paris("2026-10-25T23:30:00Z"))).toBe("2026-10-26"); // +1
  });
});

describe("minuit", () => {
  it("rend l'instant de minuit local, l'été comme l'hiver", () => {
    // Été : Paris est à +2, minuit local = 22:00 UTC la veille.
    expect(new Date(minuit(paris("2026-09-14T17:00:00Z"))).toISOString()).toBe(
      "2026-09-13T22:00:00.000Z",
    );
    // Hiver : Paris est à +1, minuit local = 23:00 UTC la veille.
    expect(new Date(minuit(paris("2026-12-14T17:00:00Z"))).toISOString()).toBe(
      "2026-12-13T23:00:00.000Z",
    );
  });

  it("est stable pour deux instants du même jour", () => {
    const matin = minuit(paris("2026-09-14T06:00:00Z"));
    const soir = minuit(paris("2026-09-14T20:00:00Z"));
    expect(matin).toBe(soir);
  });
});

describe("fenetreDuJour", () => {
  it("couvre le jour entier, bornes comprises pour le début", () => {
    const { debut, fin } = fenetreDuJour(paris("2026-09-14T16:46:00Z"));
    expect(debut.toISOString()).toBe("2026-09-13T22:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-09-14T22:00:00.000Z");
  });

  it("le match de 23:30 est du lundi, celui de 00:30 est du mardi", () => {
    const lundi = fenetreDuJour(paris("2026-09-14T12:00:00Z"));
    const a2330 = paris("2026-09-14T21:30:00Z"); // 23:30 à Paris, lundi
    const a0030 = paris("2026-09-14T22:30:00Z"); // 00:30 à Paris, mardi

    expect(a2330 >= lundi.debut && a2330 < lundi.fin).toBe(true);
    expect(a0030 >= lundi.debut && a0030 < lundi.fin).toBe(false);
  });

  it("dure 25 heures le jour où l'on recule les pendules", () => {
    // 25 octobre 2026 : la journée parisienne compte 25 heures. Calculer la
    // fin par « début + 24 h » la couperait une heure trop tôt, et le match
    // de 23:30 ce soir-là tomberait hors de sa propre soirée.
    const { debut, fin } = fenetreDuJour(paris("2026-10-25T12:00:00Z"));
    expect(fin.getTime() - debut.getTime()).toBe(25 * 3600_000);
  });

  it("dure 23 heures le jour où l'on avance les pendules", () => {
    // 29 mars 2026 : 23 heures.
    const { debut, fin } = fenetreDuJour(paris("2026-03-29T12:00:00Z"));
    expect(fin.getTime() - debut.getTime()).toBe(23 * 3600_000);
  });
});

describe("memeJour", () => {
  it("dit oui pour deux instants du même lundi", () => {
    expect(
      memeJour(paris("2026-09-14T06:06:00Z"), paris("2026-09-14T16:46:00Z")),
    ).toBe(true);
  });

  it("dit non de part et d'autre de minuit à Paris", () => {
    expect(
      memeJour(paris("2026-09-14T21:30:00Z"), paris("2026-09-14T22:30:00Z")),
    ).toBe(false);
  });
});

describe("FUSEAU", () => {
  it("est une constante, pas un réglage du club (article IX)", () => {
    expect(FUSEAU).toBe("Europe/Paris");
  });
});
