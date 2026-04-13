// Sync worker: drains the outbox FIFO, replaying each mutation against the
// server. Safe to call multiple times — a single in-flight drain is enforced
// by `inflight`. Triggered on:
//   - `online` event from the browser
//   - document focus/visibilitychange (user returns to the app)
//   - manual button from the UI
//   - after every local mutation (best-effort immediate sync when online)
//
// Server endpoints are idempotent (commit 1), so a partial replay followed
// by a retry never duplicates.

import { getDb, type OutboxEntry, type OutboxOp } from "./db";

export type SyncState = {
  online: boolean;
  pending: number;
  syncing: boolean;
  lastError: string | null;
  lastSyncedAt: string | null;
};

type Listener = (s: SyncState) => void;

const state: SyncState = {
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  pending: 0,
  syncing: false,
  lastError: null,
  lastSyncedAt: null,
};
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l({ ...state });
}

export function subscribeSync(l: Listener): () => void {
  listeners.add(l);
  l({ ...state });
  return () => void listeners.delete(l);
}

export function getSyncState(): SyncState {
  return { ...state };
}

async function refreshPending() {
  const db = getDb();
  state.pending = await db.outbox.count();
  emit();
}

// --- Network helpers -------------------------------------------------------

async function replayOp(op: OutboxOp): Promise<void> {
  switch (op.kind) {
    case "createMatch": {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(op.payload),
      });
      await throwIfBad(res, "createMatch");
      return;
    }
    case "addGoal": {
      const res = await fetch(`/api/matches/${op.matchId}/goals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(op.payload),
      });
      await throwIfBad(res, "addGoal");
      return;
    }
    case "removeGoal": {
      const res = await fetch(
        `/api/matches/${op.matchId}/goals?goalId=${encodeURIComponent(
          op.payload.goalId
        )}`,
        { method: "DELETE" }
      );
      await throwIfBad(res, "removeGoal");
      return;
    }
    case "finishMatch": {
      const res = await fetch(`/api/matches/${op.matchId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "FINISHED", mvpId: op.payload.mvpId }),
      });
      await throwIfBad(res, "finishMatch");
      return;
    }
  }
}

async function throwIfBad(res: Response, tag: string) {
  if (res.ok) return;
  let msg: string;
  try {
    const j = (await res.json()) as { error?: string };
    msg = j.error ?? res.statusText;
  } catch {
    msg = res.statusText;
  }
  const err = new Error(`${tag} → ${res.status}: ${msg}`) as Error & {
    status?: number;
  };
  err.status = res.status;
  throw err;
}

// --- Drain ----------------------------------------------------------------

let inflight: Promise<void> | null = null;

export function drainOutbox(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      await drainInner();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

async function drainInner() {
  if (!state.online) return;
  const db = getDb();

  state.syncing = true;
  state.lastError = null;
  emit();

  try {
    // Process one op at a time to preserve FIFO order. Each successful op is
    // removed from the outbox before moving on — crash-safe (at-least-once).
    // Server is idempotent, so at-least-once is the guarantee we need.
    // Loop until either the outbox is empty or we hit a retryable error.
    // Non-retryable errors (4xx other than 401) are logged and the op is
    // dropped to avoid blocking the queue forever.
    while (true) {
      const next = (await db.outbox.orderBy("createdAt").first()) as
        | OutboxEntry
        | undefined;
      if (!next) break;

      try {
        await replayOp(next.op);
        await db.outbox.delete(next.id!);
        state.lastSyncedAt = new Date().toISOString();
      } catch (e) {
        const err = e as Error & { status?: number };
        const retryable =
          err.status === undefined || // network error
          err.status === 0 ||
          err.status === 408 ||
          err.status === 429 ||
          err.status >= 500;
        const authFailure = err.status === 401;

        await db.outbox.update(next.id!, {
          attempts: (next.attempts ?? 0) + 1,
          lastError: err.message,
        });
        state.lastError = err.message;

        if (authFailure) {
          // No point retrying without a session — stop and let the UI
          // prompt the user to re-enter PIN. Outbox is preserved.
          break;
        }
        if (!retryable) {
          // Drop poisonous op so the queue keeps moving. (E.g. the player
          // was deleted server-side, so the goal can never persist.)
          await db.outbox.delete(next.id!);
          continue;
        }
        // Retryable: stop the drain and try again later (next online event).
        break;
      }
    }
  } finally {
    state.syncing = false;
    await refreshPending();
  }
}

// --- Wire-up ---------------------------------------------------------------

let initialized = false;

export function initSync() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const setOnline = (online: boolean) => {
    state.online = online;
    emit();
    if (online) void drainOutbox();
  };

  window.addEventListener("online", () => setOnline(true));
  window.addEventListener("offline", () => setOnline(false));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.online) {
      void drainOutbox();
    }
  });

  // Kick off a drain on load if already online.
  void refreshPending().then(() => {
    if (state.online) void drainOutbox();
  });
}

// Call this right after any local mutation to get a fast sync when online.
export async function kickSync() {
  await refreshPending();
  if (state.online) void drainOutbox();
}
