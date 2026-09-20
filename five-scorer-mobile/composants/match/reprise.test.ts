// Le garde de « Match suivant — mêmes équipes » et de « Rejouer », éprouvé
// contre le vrai SQLite du noyau.
//
// Le défaut qu'il verrouille a coûté une soirée : une feuille restée ouverte
// un autre lundi sur le téléphone, le match de ce soir qu'on termine, et le
// bouton « Match suivant » qui renvoyait dans la vieille feuille — sans un
// mot, avec d'autres équipes et un score qui n'était pas 0-0. Chaque but tapé
// ensuite s'écrivait, et partait au serveur, dans le match de la semaine
// dernière.
//
// D'où le premier test : il reproduit la scène entière (vieille feuille, match
// du soir, coup de sifflet final) et vérifie que `getLiveMatchOfClub` rend
// bien l'oubliée — c'est le piège — puis que `feuilleAReprendre` refuse de la
// reprendre.

import { describe, it, expect } from "vitest";
import { SCHEMA } from "../../db/schema";
import { appliquerSchema } from "../../lib/outbox/base";
import { BaseNode } from "../../lib/outbox/baseNode";
import { creerMatchLocal, type MatchLocal } from "../../lib/match/local";
import { feuilleAReprendre } from "./reprise";

const CLUB = "club1";

/// L'heure de référence des tests : un lundi, 20 h 00 à Paris. Toutes les
/// dates se calculent à partir d'elle, pour que « même jour » se lise sur le
/// calendrier local — c'est celui du téléphone.
const CE_SOIR = new Date("2026-09-07T18:00:00.000Z").getTime();
const JOUR = 24 * 3600_000;

const EFFECTIF = [
  { id: "j1", name: "Ibrahima", skill: 4, isGk: false, isGuest: false },
  { id: "j2", name: "Amadou", skill: 3, isGk: true, isGuest: false },
  { id: "j3", name: "Bakary", skill: 3, isGk: false, isGuest: false },
  { id: "j4", name: "Cheikh", skill: 2, isGk: true, isGuest: false },
];

async function noyau(): Promise<MatchLocal> {
  const base = BaseNode.ouvrir(":memory:");
  await appliquerSchema(base, SCHEMA);
  let n = 0;
  const local = creerMatchLocal({
    base,
    maintenant: () => new Date(CE_SOIR),
    nouvelId: () => `id-${++n}`,
  });
  await local.saveRoster(CLUB, EFFECTIF);
  return local;
}

function feuille(
  local: MatchLocal,
  opts: { playedAt: number; matchDayId?: string | null; nomA?: string; nomB?: string },
): Promise<string> {
  return local.createMatch({
    clubId: CLUB,
    matchDayId: opts.matchDayId ?? null,
    kind: "INTERNAL",
    teamAName: opts.nomA ?? "Rouges",
    teamBName: opts.nomB ?? "Bleus",
    teamA: [
      { playerId: "j1", isGk: false },
      { playerId: "j2", isGk: true },
    ],
    teamB: [
      { playerId: "j3", isGk: false },
      { playerId: "j4", isGk: true },
    ],
    playedAt: new Date(opts.playedAt).toISOString(),
  });
}

describe("feuilleAReprendre, contre le noyau", () => {
  it("refuse la feuille oubliée d'un autre lundi après le coup de sifflet final", async () => {
    const local = await noyau();
    const oubliee = await feuille(local, {
      playedAt: CE_SOIR - 7 * JOUR,
      matchDayId: "soiree-30",
      nomA: "Vieux A",
      nomB: "Vieux B",
    });
    const ceSoir = await feuille(local, { playedAt: CE_SOIR, matchDayId: "soiree-33" });
    await local.addEvent(ceSoir, { type: "GOAL", team: "A", playerId: "j1" });
    await local.finishMatch(ceSoir, null);

    // Le piège, tel que la base le tend : `lireMatchEnCours` ne filtre ni la
    // date ni la soirée, et le seul match LIVE du club est maintenant l'oubli.
    const enCours = await local.getLiveMatchOfClub(CLUB);
    expect(enCours?.id).toBe(oubliee);

    // « Match suivant — mêmes équipes » prolonge la soirée 33 : il ne doit
    // pas repartir dans la 30.
    expect(
      feuilleAReprendre(enCours, { matchDayId: "soiree-33", playedAt: null }, CE_SOIR),
    ).toBeNull();
  });

  it("refuse aussi quand les deux matchs sont hors soirée", async () => {
    const local = await noyau();
    await feuille(local, { playedAt: CE_SOIR - 7 * JOUR });
    const enCours = await local.getLiveMatchOfClub(CLUB);

    // `matchDayId` nul des deux côtés ne prouve rien : c'est la date qui
    // tranche.
    expect(feuilleAReprendre(enCours, { matchDayId: null, playedAt: null }, CE_SOIR)).toBeNull();
  });

  it("reprend la feuille qu'on vient d'ouvrir pour cette soirée", async () => {
    const local = await noyau();
    const juste = await feuille(local, { playedAt: CE_SOIR, matchDayId: "soiree-33" });
    const enCours = await local.getLiveMatchOfClub(CLUB);

    // Le cas pour lequel le garde existe : deux taps sur le même bouton, ou
    // un retour en arrière. Une seule feuille pour un seul terrain.
    expect(
      feuilleAReprendre(enCours, { matchDayId: "soiree-33", playedAt: null }, CE_SOIR + 4_000)?.id,
    ).toBe(juste);
  });

  it("refuse une feuille du matin ouverte et oubliée le jour même", async () => {
    const local = await noyau();
    await feuille(local, { playedAt: CE_SOIR - 9 * 3600_000, matchDayId: "soiree-33" });
    const enCours = await local.getLiveMatchOfClub(CLUB);

    // Même jour, même soirée, mais neuf heures : ce n'est plus « celle de ce
    // soir ».
    expect(
      feuilleAReprendre(enCours, { matchDayId: "soiree-33", playedAt: null }, CE_SOIR),
    ).toBeNull();
  });

  it("en rattrapage, reprend la feuille du même lundi passé", async () => {
    const local = await noyau();
    const rattrapee = await feuille(local, {
      playedAt: CE_SOIR - 7 * JOUR,
      matchDayId: "soiree-30",
    });
    const enCours = await local.getLiveMatchOfClub(CLUB);

    // « Saisir le match suivant » d'une soirée d'il y a huit jours : tout est
    // ancien par construction, l'âge ne peut pas servir de tri — la soirée et
    // le jour, si.
    const suivant = new Date(CE_SOIR - 7 * JOUR + 30 * 60_000).toISOString();
    expect(
      feuilleAReprendre(enCours, { matchDayId: "soiree-30", playedAt: suivant }, CE_SOIR)?.id,
    ).toBe(rattrapee);

    // Et la même feuille ne doit pas servir de « match suivant » à ce soir.
    expect(
      feuilleAReprendre(enCours, { matchDayId: "soiree-33", playedAt: null }, CE_SOIR),
    ).toBeNull();
  });
});
