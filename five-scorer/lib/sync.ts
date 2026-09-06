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
  /// Opérations refusées par le serveur et conservées : elles ne partiront pas
  /// toutes seules. Le badge doit le montrer — une file vidée en silence se lit
  /// comme « tout est enregistré ».
  blocked: number;
  /// Le serveur ne reconnaît plus la session : il faut se reconnecter.
  needsAuth: boolean;
  lastSyncedAt: string | null;
};

type Listener = (s: SyncState) => void;

const state: SyncState = {
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  pending: 0,
  syncing: false,
  lastError: null,
  blocked: 0,
  needsAuth: false,
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
  const toutes = await db.outbox.toArray();
  // `pending` ne compte que ce qui partira tout seul ; `blocked` ce qui exige
  // une intervention. Les confondre revenait à afficher « Synchro OK » sur une
  // file pleine d'opérations refusées.
  state.blocked = toutes.filter((o) => o.blockedAt).length;
  state.pending = toutes.length - state.blocked;
  emit();
}

/// Les opérations refusées par le serveur, pour l'écran de diagnostic.
export async function listBlockedOps(): Promise<OutboxEntry[]> {
  const db = getDb();
  return (await db.outbox.toArray()).filter((o) => o.blockedAt);
}

/// Remet les opérations bloquées dans la file — après une reconnexion, ou une
/// fois les droits rétablis par un admin.
export async function retryBlockedOps(): Promise<number> {
  const db = getDb();
  const bloquees = (await db.outbox.toArray()).filter((o) => o.blockedAt);
  await Promise.all(
    bloquees.map((o) =>
      db.outbox.update(o.id!, { blockedAt: null, attempts: 0 }),
    ),
  );
  state.needsAuth = false;
  await refreshPending();
  void kickSync();
  return bloquees.length;
}

// --- Network helpers -------------------------------------------------------

async function replayOp(op: OutboxOp): Promise<void> {
  const base = `/api/clubs/${op.clubId}`;
  switch (op.kind) {
    case "createMatch": {
      const res = await fetch(`${base}/matches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(op.payload),
      });
      await throwIfBad(res, "createMatch");
      return;
    }
    case "addEvent": {
      const res = await fetch(`${base}/matches/${op.matchId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(op.payload),
      });
      await throwIfBad(res, "addEvent");
      return;
    }
    case "removeEvent": {
      const res = await fetch(
        `${base}/matches/${op.matchId}/events?eventId=${encodeURIComponent(
          op.payload.eventId,
        )}`,
        { method: "DELETE" },
      );
      await throwIfBad(res, "removeEvent");
      return;
    }
    case "setAssist": {
      const res = await fetch(`${base}/matches/${op.matchId}/events`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(op.payload),
      });
      await throwIfBad(res, "setAssist");
      return;
    }
    case "setScorer": {
      const res = await fetch(`${base}/matches/${op.matchId}/events`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(op.payload),
      });
      await throwIfBad(res, "setScorer");
      return;
    }
    case "movePlayer": {
      const res = await fetch(`${base}/matches/${op.matchId}/lineup`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(op.payload),
      });
      await throwIfBad(res, "movePlayer");
      return;
    }
    case "finishMatch": {
      const res = await fetch(`${base}/matches/${op.matchId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "FINISHED",
          mvpId: op.payload.mvpId,
          durationMin: op.payload.durationMin ?? null,
        }),
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
    // Une opération refusée par le serveur est marquée bloquée, jamais
    // supprimée : la file continue d'avancer, et la saisie reste récupérable.
    while (true) {
      // Les opérations bloquées sont écartées de la file active : sans ce
      // filtre, la première d'entre elles resterait en tête et ferait tourner
      // le drain en boucle.
      const next = (await db.outbox
        .orderBy("createdAt")
        .filter((o) => !o.blockedAt)
        .first()) as OutboxEntry | undefined;
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
          // Session non reconnue : réessayer ne sert à rien tant que
          // l'utilisateur ne s'est pas reconnecté. On conserve la file et on
          // le DIT — auparavant le badge restait ambre indéfiniment sans
          // jamais indiquer qu'il fallait se reconnecter.
          state.needsAuth = true;
          break;
        }
        if (!retryable) {
          // On ne supprime plus. Un 4xx, c'est le plus souvent un refus de
          // droits (403) ou un match déjà terminé — pas une opération
          // empoisonnée. L'ancienne version jetait l'op, puis toutes celles
          // qui en dépendaient tombaient en 404 et étaient jetées à leur
          // tour : une soirée entière de buts disparaissait en une passe,
          // pendant que la pastille repassait au vert « Synchro OK ».
          //
          // L'op est marquée bloquée : elle sort de la file active, reste en
          // base, et devient visible dans l'interface.
          // Bloquer TOUTE la chaîne du match, pas seulement cette opération.
          // Les opérations d'un même match se suivent : laisser passer les
          // suivantes revenait à exécuter `finishMatch` par-dessus un
          // `addEvent` refusé — le match basculait terminé côté serveur, et
          // l'opération bloquée devenait alors définitivement irrécupérable
          // (son rejeu se heurte au refus « match terminé »).
          const bloqueeLe = new Date().toISOString();
          const motif = `${err.status ?? "?"} — ${err.message}`;
          const matchDeLOp = (next.op as { matchId?: string }).matchId;
          const aBloquer = matchDeLOp
            ? (await db.outbox.toArray()).filter(
                (o) =>
                  !o.blockedAt &&
                  (o.op as { matchId?: string }).matchId === matchDeLOp,
              )
            : [next];
          await Promise.all(
            aBloquer.map((o) =>
              db.outbox.update(o.id!, {
                blockedAt: bloqueeLe,
                lastError: motif,
              }),
            ),
          );
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
