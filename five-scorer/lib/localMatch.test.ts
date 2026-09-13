// Garde anti-écriture sur un match verrouillé (FINISHED ou CANCELED).
//
// lib/db.ts met en cache UNE seule instance de FiveScorerDB dans une
// variable de module (getDb()), sans API pour la réinitialiser. On ne
// réinitialise donc pas le module entre les tests — on partage UNE instance
// sur tout le fichier et on vide les tables concernées dans un beforeEach.
// C'est le choix le plus simple qui isole vraiment les tests : fake-indexeddb
// fournit un indexedDB qui fonctionne pour de bon, donc un clear() par table
// est aussi fiable qu'une base neuve, sans avoir à contourner le singleton.
//
// Modèle : five-scorer-mobile/lib/match/localMatch.test.ts (même décor —
// roster + club, un match interne à deux joueurs par équipe — mécanique
// différente : Dexie/IndexedDB ici, SQLite là-bas).

import { describe, it, expect, beforeEach } from "vitest";
import { getDb, type LocalMatch } from "./db";
import {
  addEvent,
  ajouterJoueurAuMatch,
  createMatch,
  finishMatch,
  movePlayerTeam,
  removeEvent,
  setEventAssist,
  setEventScorer,
  undoLastGoalOf,
} from "./localMatch";

const CLUB = "club1";

/// L'effectif du soir : quatre joueurs du club, deux par camp.
const EFFECTIF = [
  { id: "j1", name: "Ibrahima", skill: 4, isGk: false, isGuest: false },
  { id: "j2", name: "Amadou", skill: 3, isGk: true, isGuest: false },
  { id: "j3", name: "Bakary", skill: 3, isGk: false, isGuest: false },
  { id: "j4", name: "Cheikh", skill: 2, isGk: true, isGuest: false },
];

const db = getDb();

beforeEach(async () => {
  await Promise.all(
    [db.roster, db.matches, db.participants, db.events, db.outbox].map((t) =>
      t.clear(),
    ),
  );
  await db.roster.bulkPut(EFFECTIF.map((p) => ({ ...p, clubId: CLUB })));
});

/// Un match interne, deux joueurs de chaque côté.
async function matchDuSoir(): Promise<string> {
  return createMatch({
    clubId: CLUB,
    kind: "INTERNAL",
    teamAName: "Rouges",
    teamBName: "Bleus",
    teamA: [
      { playerId: "j1", isGk: false },
      { playerId: "j2", isGk: true },
    ],
    teamB: [
      { playerId: "j3", isGk: false },
      { playerId: "j4", isGk: true },
    ],
  });
}

async function nb(table: "events" | "participants" | "outbox"): Promise<number> {
  return db[table].count();
}

/// Les sept fonctions qui écrivent dans un match, chacune appelée de façon à
/// atteindre sa garde — avec un événement GOAL et un OWN_GOAL déjà en place.
async function essaieTout(matchId: string, goalId: string, ownGoalId: string) {
  await expect(
    addEvent(matchId, { type: "GOAL", team: "A", playerId: "j1" }),
  ).rejects.toThrow("Match terminé ou annulé");

  await expect(removeEvent(matchId, goalId)).rejects.toThrow(
    "Match terminé ou annulé",
  );

  await expect(setEventAssist(matchId, goalId, "j2")).rejects.toThrow(
    "Match terminé ou annulé",
  );

  await expect(setEventScorer(matchId, ownGoalId, "j3")).rejects.toThrow(
    "Match terminé ou annulé",
  );

  await expect(movePlayerTeam(matchId, "j1", "B")).rejects.toThrow(
    "Match terminé ou annulé",
  );

  await expect(ajouterJoueurAuMatch(matchId, "j5", "A")).rejects.toThrow(
    "Match terminé ou annulé",
  );
}

describe("aucune écriture dans un match terminé", () => {
  let matchId: string;
  let goalId: string;
  let ownGoalId: string;

  beforeEach(async () => {
    matchId = await matchDuSoir();
    goalId = await addEvent(matchId, {
      type: "GOAL",
      team: "A",
      playerId: "j1",
    });
    ownGoalId = await addEvent(matchId, {
      type: "OWN_GOAL",
      team: "A",
      playerId: null,
    });
    await finishMatch(matchId, "j1", 50);
  });

  it("addEvent, removeEvent, setEventAssist, setEventScorer, movePlayerTeam et ajouterJoueurAuMatch lèvent tous, et n'écrivent rien", async () => {
    const eventsAvant = await nb("events");
    const participantsAvant = await nb("participants");
    const outboxAvant = await nb("outbox");

    await essaieTout(matchId, goalId, ownGoalId);

    expect(await nb("events")).toBe(eventsAvant);
    expect(await nb("participants")).toBe(participantsAvant);
    expect(await nb("outbox")).toBe(outboxAvant);

    // Les deux buts saisis avant la fin du match sont toujours là, intacts.
    const ev = await db.events.get(goalId);
    expect(ev?.assistPlayerId ?? null).toBe(null);
    const csc = await db.events.get(ownGoalId);
    expect(csc?.playerId ?? null).toBe(null);
  });

  it("undoLastGoalOf (qui délègue à removeEvent) hérite de la garde", async () => {
    const eventsAvant = await nb("events");
    const outboxAvant = await nb("outbox");
    // undoLastGoalOf ne catch rien : le rejet de removeEvent remonte tel quel.
    await expect(undoLastGoalOf(matchId, "j1")).rejects.toThrow(
      "Match terminé ou annulé",
    );
    expect(await nb("events")).toBe(eventsAvant);
    expect(await nb("outbox")).toBe(outboxAvant);
  });
});

// Aucun chemin produit actuel ne fait vraiment passer un match local à
// CANCELED aujourd'hui : rien ne synchronise ce statut du serveur vers Dexie.
// On force le statut directement pour prouver que la garde elle-même — pas
// un chemin d'annulation qui n'existe pas encore — est correcte.
describe("aucune écriture dans un match annulé", () => {
  let matchId: string;
  let goalId: string;
  let ownGoalId: string;

  beforeEach(async () => {
    matchId = await matchDuSoir();
    goalId = await addEvent(matchId, {
      type: "GOAL",
      team: "A",
      playerId: "j1",
    });
    ownGoalId = await addEvent(matchId, {
      type: "OWN_GOAL",
      team: "A",
      playerId: null,
    });
    // LocalMatch.status ne connaît que "LIVE" | "FINISHED" (aucun chemin
    // produit n'écrit CANCELED en local) : Dexie n'a pas de contrainte
    // d'exécution comme le CHECK SQLite du côté mobile, donc rien n'empêche
    // d'écrire quand même la valeur — seul TypeScript s'y opposerait. Le
    // contournement est donc ici, explicite, pas dans le type partagé.
    await db.matches.update(
      matchId,
      { status: "CANCELED" } as unknown as Partial<LocalMatch>,
    );
  });

  it("addEvent, removeEvent, setEventAssist, setEventScorer, movePlayerTeam et ajouterJoueurAuMatch lèvent tous, et n'écrivent rien", async () => {
    const eventsAvant = await nb("events");
    const participantsAvant = await nb("participants");
    const outboxAvant = await nb("outbox");

    await essaieTout(matchId, goalId, ownGoalId);

    expect(await nb("events")).toBe(eventsAvant);
    expect(await nb("participants")).toBe(participantsAvant);
    expect(await nb("outbox")).toBe(outboxAvant);
  });
});
