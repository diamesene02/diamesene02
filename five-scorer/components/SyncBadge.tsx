"use client";

import { useEffect } from "react";
import { drainOutbox, initSync } from "@/lib/sync";
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

  const state = !s.online ? "off" : s.pending > 0 || s.syncing ? "warn" : "ok";
  const label = !s.online
    ? "Hors ligne"
    : s.syncing
      ? "Sync…"
      : s.pending > 0
        ? `${s.pending} à envoyer`
        : "Synchro OK";

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void drainOutbox()}
        title={s.lastError ?? label}
        aria-label={label}
        className={cn("sync-dot", state !== "ok" && state, className)}
      />
    );
  }

  const pill =
    state === "off"
      ? "bg-red-900/70 text-red-200 border-red-700"
      : state === "warn"
        ? "bg-amber-900/70 text-amber-200 border-amber-700"
        : "bg-emerald-900/60 text-emerald-200 border-emerald-700";
  const dot =
    state === "off"
      ? "bg-red-400"
      : state === "warn"
        ? "bg-amber-400 animate-pulse"
        : "bg-emerald-400";

  return (
    <button
      type="button"
      onClick={() => void drainOutbox()}
      title={s.lastError ?? undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
        pill,
        className
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {label}
    </button>
  );
}
