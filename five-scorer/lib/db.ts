// Local IndexedDB mirror of the server state, used so that the phone
// can run a full match offline and sync to the server later.
//
// Writes during a match go to this DB (+ outbox). Reads during a match
// come from this DB. The server is eventually consistent via the outbox
// worker.

import Dexie, { type Table } from "dexie";

export type LocalPlayer = {
  id: string;
  name: string;
  nickname?: string | null;
  isGuest: boolean;
};

export type LocalMatch = {
  id: string;
  playedAt: string; // ISO
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
  status: "LIVE" | "FINISHED";
  mvpId: string | null;
};

export type LocalMatchPlayer = {
  // primary key uses compound "matchId::playerId"
  key: string;
  matchId: string;
  playerId: string;
  team: "A" | "B";
};

export type LocalGoal = {
  id: string;
  matchId: string;
  scorerId: string;
  team: "A" | "B";
  minute: number | null;
  createdAt: string; // ISO
};

// --- Outbox ----------------------------------------------------------------
//
// An append-only log of mutations the phone has performed locally and that
// still need to be replayed against the server. Processed FIFO by the sync
// worker. Each op is idempotent on the server thanks to client-provided IDs.

export type OutboxOp =
  | {
      kind: "createMatch";
      matchId: string;
      payload: {
        id: string;
        playedAt: string;
        teamAName: string;
        teamBName: string;
        teamA: string[];
        teamB: string[];
      };
    }
  | {
      kind: "addGoal";
      matchId: string;
      payload: {
        id: string; // goal id
        scorerId: string;
        minute: number | null;
        createdAt: string;
      };
    }
  | {
      kind: "removeGoal";
      matchId: string;
      payload: { goalId: string };
    }
  | {
      kind: "finishMatch";
      matchId: string;
      payload: { mvpId: string | null };
    };

export type OutboxEntry = {
  id?: number; // auto-increment
  createdAt: string; // ISO
  attempts: number;
  lastError?: string | null;
  op: OutboxOp;
};

// Upsert a guest player locally so it's immediately usable in match setup.
export type LocalGuest = { id: string; name: string };

export class FiveScorerDB extends Dexie {
  roster!: Table<LocalPlayer, string>;
  matches!: Table<LocalMatch, string>;
  matchPlayers!: Table<LocalMatchPlayer, string>;
  goals!: Table<LocalGoal, string>;
  outbox!: Table<OutboxEntry, number>;

  constructor() {
    super("five-scorer");
    this.version(1).stores({
      roster: "id, name, isGuest",
      matches: "id, playedAt, status",
      matchPlayers: "key, matchId, playerId, [matchId+team]",
      goals: "id, matchId, scorerId, createdAt, [matchId+createdAt]",
      // index by createdAt so the worker drains FIFO
      outbox: "++id, createdAt",
    });
  }
}

// Singleton. Lazily created on first access so it only runs in the browser.
let _db: FiveScorerDB | null = null;
export function getDb(): FiveScorerDB {
  if (typeof window === "undefined") {
    throw new Error("FiveScorerDB can only be used in the browser");
  }
  if (!_db) _db = new FiveScorerDB();
  return _db;
}
