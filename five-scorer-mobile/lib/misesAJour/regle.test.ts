// La seule règle de la mise à jour à chaud, éprouvée sur un vrai moteur SQLite.

import { describe, it, expect } from "vitest";
import { BaseNode } from "../outbox/baseNode";
import { appliquerSchema } from "../outbox/base";
import { SCHEMA } from "../../db/schema";
import { matchEnCours } from "./regle";

async function base() {
  const b = BaseNode.ouvrir();
  await appliquerSchema(b, SCHEMA);
  return b;
}

async function ecrireMatch(b: BaseNode, id: string, status: "LIVE" | "FINISHED") {
  await b.executer(
    `INSERT INTO matches (id, club_id, kind, played_at, team_a_name, team_b_name, status)
     VALUES (?, ?, 'INTERNAL', ?, 'Bleus', 'Rouges', ?)`,
    [id, "club1", "2026-09-11T20:00:00.000Z", status],
  );
}

describe("recharger l'app pour un correctif", () => {
  it("est INTERDIT tant qu'une feuille est ouverte", async () => {
    const b = await base();
    await ecrireMatch(b, "m1", "LIVE");
    expect(await matchEnCours(b)).toBe(true);
  });

  it("est permis quand le match est terminé", async () => {
    const b = await base();
    await ecrireMatch(b, "m1", "FINISHED");
    expect(await matchEnCours(b)).toBe(false);
  });

  it("est permis sur une base sans aucun match", async () => {
    expect(await matchEnCours(await base())).toBe(false);
  });

  it("reste interdit si UN SEUL des matchs est en cours", async () => {
    // Le cas d'une soirée : quatre matchs joués, le cinquième en cours.
    const b = await base();
    await ecrireMatch(b, "m1", "FINISHED");
    await ecrireMatch(b, "m2", "FINISHED");
    await ecrireMatch(b, "m3", "LIVE");
    expect(await matchEnCours(b)).toBe(true);
  });
});
