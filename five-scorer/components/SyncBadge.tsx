"use client";

import { useEffect } from "react";
import { drainOutbox, retryBlockedOps, initSync } from "@/lib/sync";
import { useSyncState } from "@/lib/useSyncState";
import { cn } from "@/lib/cn";

// Compact status pill. Shows:
//   🟢 "Sync ok" when online and outbox empty
//   🟡 "N à envoyer" when there's an outbox (tapping forces a drain)
//   🔴 "Hors ligne" when no network
export default function SyncBadge({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  useEffect(() => initSync(), []);
  const s = useSyncState();

  // Les opérations refusées par le serveur passent en premier : elles ne
  // partiront pas toutes seules, et rien ne doit laisser croire le contraire.
  // Auparavant elles étaient supprimées en silence et la pastille repassait au
  // vert — l'utilisateur croyait son match enregistré alors qu'il était perdu.
  const state = s.needsAuth
    ? "off"
    : s.blocked > 0
      ? "off"
      : !s.online
        ? "off"
        : s.pending > 0 || s.syncing
          ? "warn"
          : "ok";

  const label = s.needsAuth
    ? "Reconnecte-toi pour envoyer"
    : s.blocked > 0
      ? `${s.blocked} action${s.blocked > 1 ? "s" : ""} refusée${s.blocked > 1 ? "s" : ""}`
      : !s.online
        ? "Hors ligne"
        : s.syncing
          ? "Sync…"
          : s.pending > 0
            ? `${s.pending} à envoyer`
            : "Synchro OK";

  // Le tap sur la pastille est le seul geste offert. Quand des opérations sont
  // bloquées, un simple drain ne sert à rien : elles sont écartées de la file
  // active. On les y remet — après une reconnexion, ou une fois les droits
  // rétablis par un admin. Sans ça, « bloqué » n'a aucune sortie et la saisie
  // reste prisonnière.
  const onTap = () => {
    if (s.blocked > 0 || s.needsAuth) void retryBlockedOps();
    else void drainOutbox();
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={onTap}
        title={
          s.blocked > 0
            ? `${label} — touche pour réessayer${s.lastError ? ` (${s.lastError})` : ""}`
            : (s.lastError ?? label)
        }
        aria-label={label}
        className={cn("sync-dot", state !== "ok" && state, className)}
      />
    );
  }

  const pill =
    state === "off"
      ? "bg-[color:var(--pitch-2)] text-[color:var(--loss)] border-[color:var(--loss)]"
      : state === "warn"
        ? "bg-amber-900/70 text-amber-200 border-amber-700"
        : "bg-emerald-900/60 text-emerald-200 border-emerald-700";
  const dot =
    state === "off"
      ? "bg-[color:var(--loss)]"
      : state === "warn"
        ? "bg-amber-400 animate-pulse"
        : "bg-emerald-400";

  return (
    <button
      type="button"
      onClick={onTap}
      title={s.lastError ?? undefined}
      className={cn(
 "inline-flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 text-xs font-medium transition",
        pill,
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {label}
    </button>
  );
}
