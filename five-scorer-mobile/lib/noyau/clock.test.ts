// Le chrono. Ce qui compte ici : il se DÉRIVE, il ne se ticke pas — donc la
// suspension des timers par iOS quand l'écran s'éteint ne peut pas le décaler.

import { describe, it, expect } from "vitest";
import { nowElapsed, start, pause, fmt, minuteOf } from "./clock";

const T = Date.parse("2026-09-07T20:30:00.000Z");
const iso = (t: number) => new Date(t).toISOString();

describe("nowElapsed", () => {
  it("en pause, rend le temps figé", () => {
    expect(nowElapsed({ elapsedMs: 90_000, runningSince: null }, T)).toBe(
      90_000,
    );
  });

  it("en marche, ajoute le temps écoulé depuis le départ", () => {
    const c = { elapsedMs: 60_000, runningSince: iso(T) };
    expect(nowElapsed(c, T + 5_000)).toBe(65_000);
  });

  it("une horloge du téléphone qui RECULE ne fait pas reculer le chrono", () => {
    // Le cas réel : mise à l'heure automatique pendant le match.
    const c = { elapsedMs: 60_000, runningSince: iso(T) };
    expect(nowElapsed(c, T - 30_000)).toBe(60_000);
  });
});

describe("start / pause", () => {
  it("start sur un chrono déjà lancé ne change rien", () => {
    const c = { elapsedMs: 1_000, runningSince: iso(T) };
    expect(start(c, T + 10_000)).toBe(c);
  });

  it("pause sur un chrono déjà arrêté ne change rien", () => {
    const c = { elapsedMs: 1_000, runningSince: null };
    expect(pause(c, T + 10_000)).toBe(c);
  });

  it("start puis pause fige le temps couru", () => {
    const lance = start({ elapsedMs: 0, runningSince: null }, T);
    expect(lance.runningSince).toBe(iso(T));
    const fige = pause(lance, T + 123_000);
    expect(fige).toEqual({ elapsedMs: 123_000, runningSince: null });
  });

  it("deux mi-temps s'additionnent", () => {
    let c = start({ elapsedMs: 0, runningSince: null }, T);
    c = pause(c, T + 600_000);
    c = start(c, T + 900_000); // 5 min de mi-temps, non comptées
    c = pause(c, T + 1_500_000);
    expect(c.elapsedMs).toBe(1_200_000); // 20 min de jeu
  });
});

describe("fmt", () => {
  it("formate en MM:SS", () => {
    expect(fmt(0)).toBe("00:00");
    expect(fmt(65_000)).toBe("01:05");
    expect(fmt(599_000)).toBe("09:59");
  });

  it("ne repasse pas à zéro après une heure", () => {
    expect(fmt(3_600_000)).toBe("60:00");
    expect(fmt(3_661_000)).toBe("61:01");
  });

  it("un temps négatif reste à zéro", () => {
    expect(fmt(-5_000)).toBe("00:00");
  });
});

describe("minuteOf", () => {
  it("tamponne la minute entière, 0-based", () => {
    expect(minuteOf(0)).toBe(0);
    expect(minuteOf(59_999)).toBe(0);
    expect(minuteOf(60_000)).toBe(1);
    expect(minuteOf(-1)).toBe(0);
  });
});
