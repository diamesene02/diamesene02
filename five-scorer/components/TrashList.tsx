"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type TrashedMatch = {
  id: string;
  playedAt: string;
  deletedAt: string;
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
  status: "LIVE" | "FINISHED";
  mvpName: string | null;
};

export default function TrashList({ matches }: { matches: TrashedMatch[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusyId(null);
    }
  }

  async function purge(id: string) {
    if (!confirm("Supprimer définitivement ? Cette action est irréversible.")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${id}?purge=1`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div
          className="cursor-pointer rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-200"
          onClick={() => setError(null)}
        >
          {error}
        </div>
      )}

      <ul className="space-y-2">
        {matches.map((m) => {
          const played = new Date(m.playedAt).toLocaleDateString("fr-FR", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
          const deletedAgo = relativeFromNow(new Date(m.deletedAt));
          return (
            <li
              key={m.id}
              className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)]/60 p-4 backdrop-blur"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">
                    {m.teamAName} <span className="font-mono text-[color:var(--a-400)]">{m.scoreA}</span>
                    <span className="px-1 text-[color:var(--ink-2)]">—</span>
                    <span className="font-mono text-[color:var(--b-400)]">{m.scoreB}</span> {m.teamBName}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-widest text-[color:var(--ink-2)]">
                    {played} · supprimé {deletedAgo}
                    {m.mvpName && <span> · ⭐ {m.mvpName}</span>}
                    {m.status === "LIVE" && (
                      <span className="ml-1 text-[color:var(--live)]">· LIVE</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => restore(m.id)}
                  disabled={busyId === m.id}
                  className="flex-1 rounded-lg border border-[color:var(--a-500)]/40 bg-[color:var(--a-500)]/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-[color:var(--a-400)] hover:brightness-110 disabled:opacity-50"
                >
                  ↺ Restaurer
                </button>
                <button
                  onClick={() => purge(m.id)}
                  disabled={busyId === m.id}
                  className="rounded-lg border border-red-700 bg-red-900/30 px-3 py-2 text-xs font-bold uppercase tracking-widest text-red-300 hover:bg-red-900/60 disabled:opacity-50"
                >
                  🗑 Purger
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function relativeFromNow(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const day = Math.floor(h / 24);
  if (day < 30) return `il y a ${day} j`;
  const mo = Math.floor(day / 30);
  return `il y a ${mo} mois`;
}
