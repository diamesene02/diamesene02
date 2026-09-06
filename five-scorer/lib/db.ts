// Miroir IndexedDB local de l'état serveur, scopé par club, pour jouer un
// match complet hors-ligne et synchroniser ensuite (voir lib/sync.ts).
//
// v2 : multi-club (clubId partout) + événements typés (buts, csc, cartons)
// à la place des simples buts.

import Dexie, { type Table } from "dexie";

export type LocalPlayer = {
  id: string;
  clubId: string;
  name: string;
  nickname?: string | null;
  skill: number;
  isGk: boolean;
  isGuest: boolean;
};

export type LocalMatch = {
  id: string;
  clubId: string;
  matchDayId?: string | null;
  seasonId?: string | null;
  kind: "INTERNAL" | "EXTERNAL";
  opponentId?: string | null;
  playedAt: string; // ISO
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
  status: "LIVE" | "FINISHED";
  mvpId: string | null;
  /// État du chrono, persisté pour survivre aux reloads/changements d'onglet.
  /// elapsedMs = temps de jeu cumulé hors pauses au moment de pausedAt (ou du
  /// dernier resume) ; runningSince = timestamp du dernier départ (null si en
  /// pause) ; period = période courante (1 puis 2 après la mi-temps).
  clockElapsedMs?: number;
  clockRunningSince?: string | null; // ISO
  period?: number;
};

export type LocalParticipant = {
  // clé primaire composée "matchId::playerId"
  key: string;
  matchId: string;
  playerId: string;
  team: "A" | "B";
  isGk: boolean;
};

export type LocalEventType =
  | "GOAL"
  | "OWN_GOAL"
  | "YELLOW_CARD"
  | "RED_CARD"
  | "HALF_TIME";

export type LocalEvent = {
  id: string;
  matchId: string;
  type: LocalEventType;
  /// Équipe créditée (pour un but, celle qui marque — y compris sur csc).
  team: "A" | "B";
  playerId: string | null;
  assistPlayerId?: string | null;
  minute: number | null;
  createdAt: string; // ISO
};

// --- Outbox ----------------------------------------------------------------
//
// Journal append-only des mutations locales à rejouer contre le serveur.
// FIFO, idempotent côté serveur grâce aux IDs générés client.

export type OutboxOp =
  | {
      kind: "createMatch";
      clubId: string;
      matchId: string;
      payload: {
        id: string;
        playedAt: string;
        matchDayId?: string | null;
        seasonId?: string | null;
        matchKind: "INTERNAL" | "EXTERNAL";
        opponentId?: string | null;
        teamAName: string;
        teamBName: string;
        teamA: { playerId: string; isGk: boolean }[];
        teamB: { playerId: string; isGk: boolean }[];
        /// Invités créés hors-ligne, upsert côté serveur avant les compos.
        guests: { id: string; name: string }[];
      };
    }
  | {
      kind: "addEvent";
      clubId: string;
      matchId: string;
      payload: {
        id: string;
        type: LocalEventType;
        team: "A" | "B";
        playerId: string | null;
        assistPlayerId?: string | null;
        minute: number | null;
        createdAt: string;
      };
    }
  | {
      kind: "removeEvent";
      clubId: string;
      matchId: string;
      payload: { eventId: string };
    }
  | {
      kind: "setAssist";
      clubId: string;
      matchId: string;
      payload: { eventId: string; assistPlayerId: string | null };
    }
  | {
      kind: "finishMatch";
      clubId: string;
      matchId: string;
      payload: { mvpId: string | null; durationMin?: number | null };
    };

export type OutboxEntry = {
  id?: number; // auto-incrément
  createdAt: string; // ISO
  attempts: number;
  lastError?: string | null;
  op: OutboxOp;
};

export class FiveScorerDB extends Dexie {
  roster!: Table<LocalPlayer, string>;
  matches!: Table<LocalMatch, string>;
  participants!: Table<LocalParticipant, string>;
  events!: Table<LocalEvent, string>;
  outbox!: Table<OutboxEntry, number>;

  constructor() {
    super("five-scorer");
    // Déclaration v1 conservée pour que Dexie sache upgrader les anciens
    // clients installés.
    this.version(1).stores({
      roster: "id, name, isGuest",
      matches: "id, playedAt, status",
      matchPlayers: "key, matchId, playerId, [matchId+team]",
      goals: "id, matchId, scorerId, createdAt, [matchId+createdAt]",
      outbox: "++id, createdAt",
    });
    // v2 : multi-club + events. Le schéma v1 a trop changé pour une
    // conversion in-place et la source de vérité durable est le serveur —
    // on vide les données locales v1 (l'outbox v1 comprise : ses ops visent
    // des endpoints qui n'existent plus).
    this.version(2)
      .stores({
        roster: "id, clubId, [clubId+isGuest]",
        matches: "id, clubId, [clubId+status], playedAt",
        participants: "key, matchId, playerId",
        events: "id, matchId, createdAt, [matchId+createdAt]",
        outbox: "++id, createdAt",
        matchPlayers: null,
        goals: null,
      })
      .upgrade(async (tx) => {
        await Promise.all([
          tx.table("roster").clear(),
          tx.table("matches").clear(),
          tx.table("outbox").clear(),
        ]);
      });
  }
}

// Singleton, créé paresseusement (navigateur uniquement).
let _db: FiveScorerDB | null = null;
export function getDb(): FiveScorerDB {
  if (typeof window === "undefined") {
    throw new Error("FiveScorerDB can only be used in the browser");
  }
  if (!_db) _db = new FiveScorerDB();
  return _db;
}
