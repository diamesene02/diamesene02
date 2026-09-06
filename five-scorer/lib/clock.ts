// Chrono de match persistant — helpers purs, sans I/O.
//
// L'état vit dans la ligne Dexie du match (clockElapsedMs / clockRunningSince,
// voir lib/db.ts) : `elapsedMs` est le temps de jeu cumulé figé au dernier
// pause/resume, `runningSince` l'ISO du dernier départ (null si en pause).
// Le temps affiché se dérive à la volée via nowElapsed — rien à ticker en base.

export type ClockState = { elapsedMs: number; runningSince: string | null };

/// Temps de jeu total en ms à l'instant `now` (défaut : Date.now()).
export function nowElapsed(c: ClockState, now: number = Date.now()): number {
  return (
    c.elapsedMs +
    (c.runningSince ? Math.max(0, now - Date.parse(c.runningSince)) : 0)
  );
}

/// Démarre (ou reprend) le chrono. No-op s'il tourne déjà.
export function start(c: ClockState, now: number = Date.now()): ClockState {
  if (c.runningSince) return c;
  return { elapsedMs: c.elapsedMs, runningSince: new Date(now).toISOString() };
}

/// Met en pause : fige le temps couru dans elapsedMs. No-op si déjà en pause.
export function pause(c: ClockState, now: number = Date.now()): ClockState {
  if (!c.runningSince) return c;
  return { elapsedMs: nowElapsed(c, now), runningSince: null };
}

/// "MM:SS" — les minutes peuvent dépasser 59 (pas de rollover horaire).
export function fmt(ms: number): string {
  const totalS = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(totalS / 60)).padStart(2, "0");
  const ss = String(totalS % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/// Minute de jeu entière (0-based) pour tamponner les événements.
export function minuteOf(ms: number): number {
  return Math.max(0, Math.floor(ms / 60000));
}
