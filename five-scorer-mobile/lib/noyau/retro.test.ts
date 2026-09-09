// La bascule « match saisi après coup ».
//
// Six heures : plus long qu'une soirée de five, plus court qu'une nuit. Un
// match ouvert la veille et oublié bascule donc en rétro le lendemain.

import { describe, it, expect, vi, afterEach } from "vitest";
import { estRetro, RETRO_APRES_MS } from "./retro";

const LUNDI_20H = Date.parse("2026-09-07T20:00:00.000Z");

afterEach(() => {
  vi.useRealTimers();
});

function le(instant: number) {
  vi.useFakeTimers();
  vi.setSystemTime(instant);
}

describe("RETRO_APRES_MS", () => {
  it("vaut six heures", () => {
    expect(RETRO_APRES_MS).toBe(6 * 3600_000);
  });
});

describe("estRetro", () => {
  it("un match qui commence n'est pas rétro", () => {
    le(LUNDI_20H);
    expect(estRetro(LUNDI_20H)).toBe(false);
  });

  it("un match de deux heures, en cours, n'est toujours pas rétro", () => {
    le(LUNDI_20H + 2 * 3600_000);
    expect(estRetro(LUNDI_20H)).toBe(false);
  });

  it("à six heures pile, pas encore rétro — c'est un « strictement plus grand »", () => {
    le(LUNDI_20H + RETRO_APRES_MS);
    expect(estRetro(LUNDI_20H)).toBe(false);
  });

  it("la feuille oubliée bascule le lendemain", () => {
    le(LUNDI_20H + 14 * 3600_000);
    expect(estRetro(LUNDI_20H)).toBe(true);
  });

  it("accepte un ISO, un Date et un nombre", () => {
    le(LUNDI_20H + 14 * 3600_000);
    const iso = new Date(LUNDI_20H).toISOString();
    expect(estRetro(iso)).toBe(true);
    expect(estRetro(new Date(LUNDI_20H))).toBe(true);
    expect(estRetro(LUNDI_20H)).toBe(true);
  });

  it("une date illisible n'est pas rétro — on ne devine pas", () => {
    le(LUNDI_20H);
    expect(estRetro("le lundi d'après")).toBe(false);
    expect(estRetro(new Date("nawak"))).toBe(false);
  });

  it("un match programmé dans le futur n'est pas rétro", () => {
    le(LUNDI_20H);
    expect(estRetro(LUNDI_20H + 7 * 24 * 3600_000)).toBe(false);
  });
});
