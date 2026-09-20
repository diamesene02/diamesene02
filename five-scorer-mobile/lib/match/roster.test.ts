// Le miroir de l'effectif : ce que `saveRoster` écrase, et ce qu'il garde.
//
// La règle qui se teste ici tient en une phrase : une fiche qui arrive SANS
// champ `photo` ne dit pas « ce joueur n'a plus de visage », elle ne dit rien.
// Les compos prêtes à lancer (le coup d'envoi de l'accueil, « On rejoue » au
// bas d'un récap) n'envoient plus les photos — elles sont déjà ailleurs dans
// la même réponse du serveur, et les recopier doublait le poids de l'écran le
// plus ouvert de l'app. Si `saveRoster` écrasait par `null` ce que le
// téléphone a déjà, un coup d'envoi suffirait à vider les visages de la
// feuille de match, au gymnase, sans réseau pour les rattraper.
//
// `photo: null` explicite, lui, doit bien effacer : c'est la réponse de
// l'effectif, qui fait autorité.

import { describe, it, expect } from "vitest";
import { SCHEMA } from "../../db/schema";
import { appliquerSchema } from "../outbox/base";
import { BaseNode } from "../outbox/baseNode";
import { creerMatchLocal, type MatchLocal } from "./local";

const CLUB = "club1";
const VISAGE = "data:image/jpeg;base64,AAAA";

async function local(): Promise<MatchLocal> {
  const base = BaseNode.ouvrir(":memory:");
  await appliquerSchema(base, SCHEMA);
  return creerMatchLocal({ base });
}

/// La photo telle qu'elle est en base, pour un joueur.
async function photoDe(l: MatchLocal, id: string): Promise<string | null> {
  const effectif = await l.effectifDuClub(CLUB);
  return effectif.find((p) => p.id === id)?.photo ?? null;
}

const AMADOU = {
  id: "j1",
  name: "Amadou",
  skill: 3,
  isGk: false,
  isGuest: false,
};

describe("saveRoster et les visages", () => {
  it("garde la photo déjà en base quand la fiche arrive sans le champ", async () => {
    const l = await local();
    await l.saveRoster(CLUB, [{ ...AMADOU, photo: VISAGE }]);

    // Ce que fait un coup d'envoi ou un « On rejoue » : nom, niveau, poste,
    // pas de photo.
    await l.saveRoster(CLUB, [AMADOU]);

    expect(await photoDe(l, "j1")).toBe(VISAGE);
  });

  it("efface la photo quand le serveur envoie `photo: null`", async () => {
    const l = await local();
    await l.saveRoster(CLUB, [{ ...AMADOU, photo: VISAGE }]);

    // Ce que fait la réponse de l'effectif pour un joueur qui a retiré sa
    // photo : le serveur a raison.
    await l.saveRoster(CLUB, [{ ...AMADOU, photo: null }]);

    expect(await photoDe(l, "j1")).toBeNull();
  });

  it("n'invente pas de visage pour un joueur que le téléphone découvre", async () => {
    const l = await local();
    await l.saveRoster(CLUB, [AMADOU]);
    expect(await photoDe(l, "j1")).toBeNull();
  });

  it("garde le visage de chacun quand le lot mêle fiches muettes et fiches parlantes", async () => {
    const l = await local();
    const bakary = { id: "j2", name: "Bakary", skill: 4, isGk: true, isGuest: false };
    await l.saveRoster(CLUB, [
      { ...AMADOU, photo: VISAGE },
      { ...bakary, photo: `${VISAGE}BB` },
    ]);

    await l.saveRoster(CLUB, [AMADOU, { ...bakary, photo: null }]);

    expect(await photoDe(l, "j1")).toBe(VISAGE);
    expect(await photoDe(l, "j2")).toBeNull();
  });
});
