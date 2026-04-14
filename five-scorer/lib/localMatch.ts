// Local-first actions for a match. All mutations:
//   1. Update the Dexie tables (so the UI re-renders immediately)
//   2. Append an OutboxEntry so the sync worker can replay them
//
// These functions NEVER call the network — the network is the sync worker's
// job (see lib/sync.ts). That keeps the live-scoring UI instant & offline-safe.

import Dexie from "dexie";
import { getDb, type LocalMatch, type OutboxOp } from "./db";
import { newId } from "./ids";

function mpKey(matchId: string, playerId: string) {
  return `${matchId}::${playerId}`;
}

async function enqueue(op: OutboxOp) {
  const db = getDb();
  await db.outbox.add({
    createdAt: new Date().toISOString(),
    attempts: 0,
    op,
  });
}

// --- Roster cache ----------------------------------------------------------

export async function saveRoster(
  players: { id: string; name: string; nickname?: string | null; isGuest: boolean }[]
) {
  const db = getDb();
  await db.roster.bulkPut(players);
}

export async function addLocalGuest(name: string): Promise<string> {
  const id = newId();
  const db = getDb();
  await db.roster.put({ id, name, nickname: null, isGuest: true });
  return id;
}

// --- Match lifecycle -------------------------------------------------------

export type CreateMatchInput = {
  teamAName: string;
  teamBName: string;
  teamA: string[]; // player IDs
  teamB: string[]; // player IDs
};

export async function createMatch(input: CreateMatchInput): Promise<string> {
  const db = getDb();
  const id = newId();
  const playedAt = new Date().toISOString();

  await db.transaction(
    "rw",
    db.matches,
    db.matchPlayers,
    db.outbox,
    async () => {
      await db.matches.put({
        id,
        playedAt,
        teamAName: input.teamAName,
        teamBName: input.teamBName,
        scoreA: 0,
        scoreB: 0,
        status: "LIVE",
        mvpId: null,
      });

      const mps = [
        ...input.teamA.map((pid) => ({
          key: mpKey(id, pid),
          matchId: id,
          playerId: pid,
          team: "A" as const,
        })),
        ...input.teamB.map((pid) => ({
          key: mpKey(id, pid),
          matchId: id,
          playerId: pid,
          team: "B" as const,
        })),
      ];
      await db.matchPlayers.bulkPut(mps);

      await enqueue({
        kind: "createMatch",
        matchId: id,
        payload: {
          id,
          playedAt,
          teamAName: input.teamAName,
          teamBName: input.teamBName,
          teamA: input.teamA,
          teamB: input.teamB,
        },
      });
    }
  );

  return id;
}

export async function scoreGoal(
  matchId: string,
  scorerId: string,
  opts: { minute?: number | null; assistId?: string | null } = {}
): Promise<string> {
  const db = getDb();
  const goalId = newId();
  const createdAt = new Date().toISOString();

  await db.transaction(
    "rw",
    db.matches,
    db.matchPlayers,
    db.goals,
    db.outbox,
    async () => {
      const mp = await db.matchPlayers.get(mpKey(matchId, scorerId));
      if (!mp) throw new Error("Joueur non inscrit à ce match");
      const match = await db.matches.get(matchId);
      if (!match) throw new Error("Match introuvable");
      if (match.status === "FINISHED") throw new Error("Match terminé");

      // Compute minute from match start
      const started = new Date(match.playedAt).getTime();
      const minute = opts.minute ?? Math.max(0, Math.floor((Date.now() - started) / 60000));

      await db.goals.put({
        id: goalId,
        matchId,
        scorerId,
        assistId: opts.assistId ?? null,
        team: mp.team,
        minute,
        createdAt,
      });

      await db.matches.update(matchId, {
        scoreA: mp.team === "A" ? match.scoreA + 1 : match.scoreA,
        scoreB: mp.team === "B" ? match.scoreB + 1 : match.scoreB,
      });

      await enqueue({
        kind: "addGoal",
        matchId,
        payload: {
          id: goalId,
          scorerId,
          assistId: opts.assistId ?? null,
          team: mp.team,
          minute,
          createdAt,
        },
      });
    }
  );

  return goalId;
}

export async function setAssist(goalId: string, assistId: string | null): Promise<void> {
  const db = getDb();
  const goal = await db.goals.get(goalId);
  if (!goal) return;
  await db.goals.update(goalId, { assistId });
  await enqueue({
    kind: "updateGoalAssist",
    matchId: goal.matchId,
    payload: { goalId, assistId },
  });
}

// Remove the most recent goal of that scorer (undo button). Returns the
// removed goal id, or null if there was nothing to undo.
export async function undoLastGoalOf(
  matchId: string,
  scorerId: string
): Promise<string | null> {
  const db = getDb();

  return db.transaction(
    "rw",
    db.matches,
    db.goals,
    db.outbox,
    async () => {
      const last = await db.goals
        .where("[matchId+createdAt]")
        .between([matchId, Dexie.minKey], [matchId, Dexie.maxKey])
        .filter((g) => g.scorerId === scorerId)
        .last();
      if (!last) return null;

      await db.goals.delete(last.id);

      const match = await db.matches.get(matchId);
      if (match) {
        await db.matches.update(matchId, {
          scoreA: last.team === "A" ? Math.max(0, match.scoreA - 1) : match.scoreA,
          scoreB: last.team === "B" ? Math.max(0, match.scoreB - 1) : match.scoreB,
        });
      }

      await enqueue({
        kind: "removeGoal",
        matchId,
        payload: { goalId: last.id },
      });

      return last.id;
    }
  );
}

export async function finishMatch(
  matchId: string,
  mvpId: string | null
): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.matches, db.outbox, async () => {
    await db.matches.update(matchId, { status: "FINISHED", mvpId });
    await enqueue({
      kind: "finishMatch",
      matchId,
      payload: { mvpId },
    });
  });
}

// --- Selectors -------------------------------------------------------------

export async function getLocalMatch(matchId: string) {
  const db = getDb();
  const [match, mps, goals] = await Promise.all([
    db.matches.get(matchId),
    db.matchPlayers.where("matchId").equals(matchId).toArray(),
    db.goals.where("matchId").equals(matchId).sortBy("createdAt"),
  ]);
  if (!match) return null;

  const goalCount: Record<string, number> = {};
  const assistCount: Record<string, number> = {};
  for (const g of goals) {
    goalCount[g.scorerId] = (goalCount[g.scorerId] ?? 0) + 1;
    if (g.assistId) assistCount[g.assistId] = (assistCount[g.assistId] ?? 0) + 1;
  }

  // Union of match players + any assist IDs (usually a subset already)
  const assistIds = Array.from(new Set(goals.map((g) => g.assistId).filter(Boolean) as string[]));
  const allIds = Array.from(new Set([...mps.map((mp) => mp.playerId), ...assistIds]));
  const roster = await db.roster.bulkGet(allIds);
  const rosterById = new Map<string, { id: string; name: string }>();
  roster.forEach((p) => {
    if (p) rosterById.set(p.id, { id: p.id, name: p.name });
  });

  const teamA = mps
    .filter((mp) => mp.team === "A")
    .map((mp) => ({
      id: mp.playerId,
      name: rosterById.get(mp.playerId)?.name ?? "?",
      goals: goalCount[mp.playerId] ?? 0,
      assists: assistCount[mp.playerId] ?? 0,
    }));
  const teamB = mps
    .filter((mp) => mp.team === "B")
    .map((mp) => ({
      id: mp.playerId,
      name: rosterById.get(mp.playerId)?.name ?? "?",
      goals: goalCount[mp.playerId] ?? 0,
      assists: assistCount[mp.playerId] ?? 0,
    }));

  const enrichedGoals = goals.map((g) => ({
    ...g,
    scorerName: rosterById.get(g.scorerId)?.name ?? "?",
    assistName: g.assistId ? rosterById.get(g.assistId)?.name ?? null : null,
  }));

  return { match: match satisfies LocalMatch, teamA, teamB, goals: enrichedGoals };
}
