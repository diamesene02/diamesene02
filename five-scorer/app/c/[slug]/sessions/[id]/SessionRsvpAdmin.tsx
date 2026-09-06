"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { setRsvp } from "@/app/actions/matchday";
import type { RsvpStatus } from "@prisma/client";

export type SessionPlayerRow = {
  playerId: string;
  name: string;
  status: RsvpStatus | null; // null = sans réponse
};

const SELF_LABELS: Record<RsvpStatus, string> = {
  IN: "Présent",
  MAYBE: "Peut-être",
  OUT: "Absent",
};

/// Tap admin : cycle IN → MAYBE → OUT (sans réponse → IN).
function nextStatus(s: RsvpStatus | null): RsvpStatus {
  if (s === "IN") return "MAYBE";
  if (s === "MAYBE") return "OUT";
  return "IN"; // OUT ou sans réponse
}

const DOT: Record<RsvpStatus, string> = {
  IN: "bg-[color:var(--a-400)]",
  MAYBE: "bg-[color:var(--gold)]",
  OUT: "bg-[color:var(--loss)]",
};

export default function SessionRsvpAdmin({
  slug,
  matchDayId,
  myPlayerId,
  canManage,
  players,
}: {
  slug: string;
  matchDayId: string;
  myPlayerId: string | null;
  canManage: boolean;
  players: SessionPlayerRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(players);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const mine = myPlayerId
    ? rows.find((r) => r.playerId === myPlayerId)?.status ?? null
    : null;

  function apply(playerId: string, status: RsvpStatus) {
    setError(null);
    // Optimiste : maj locale immédiate.
    setRows((prev) =>
      prev.map((r) => (r.playerId === playerId ? { ...r, status } : r))
    );
    startTransition(async () => {
      const res = await setRsvp(slug, matchDayId, playerId, status);
      if (!res.ok) {
        setError(res.error ?? "Erreur");
      }
      router.refresh();
    });
  }

  const groups: { key: string; label: string; list: SessionPlayerRow[] }[] = [
    { key: "in", label: "Présents", list: rows.filter((r) => r.status === "IN") },
    {
      key: "maybe",
      label: "Peut-être",
      list: rows.filter((r) => r.status === "MAYBE"),
    },
    { key: "out", label: "Absents", list: rows.filter((r) => r.status === "OUT") },
    {
      key: "none",
      label: "Sans réponse",
      list: rows.filter((r) => r.status === null),
    },
  ];

  return (
    <div>
      {/* Ma réponse */}
      {myPlayerId && (
        <div className="mb-5 flex gap-2">
          {(["IN", "MAYBE", "OUT"] as const).map((s) => (
            <button
              key={s}
              disabled={pending}
              onClick={() => apply(myPlayerId, s)}
              className={cn(
                "big-touch flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors",
                mine === s
                  ? s === "IN"
                    ? "border-[color:var(--a-500)] bg-[color:var(--a-wash)] text-[color:var(--a-400)]"
                    : s === "OUT"
                      ? "border-[color:var(--loss)]/60 bg-[color:var(--loss)]/10 text-[color:var(--loss)]"
                      : "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/10 text-[color:var(--gold)]"
                  : "border-[color:var(--stroke)] bg-[color:var(--bg-2)] text-[color:var(--ink-1)] hover:border-[color:var(--stroke-hi)]"
              )}
            >
              {SELF_LABELS[s]}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="mb-3 text-sm text-[color:var(--loss)]">{error}</p>
      )}

      <div className="space-y-4">
        {groups.map(
          (g) =>
            g.list.length > 0 && (
              <div key={g.key}>
                <div className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-[color:var(--ink-2)]">
                  {g.label}{" "}
                  <span className="tabular-nums">({g.list.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.list.map((p) => {
                    const inner = (
                      <>
                        <span
                          className={cn(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            p.status
                              ? DOT[p.status]
                              : "bg-[color:var(--ink-2)]/50"
                          )}
                        />
                        {p.name}
                      </>
                    );
                    return canManage ? (
                      <button
                        key={p.playerId}
                        disabled={pending}
                        onClick={() => apply(p.playerId, nextStatus(p.status))}
                        title="Changer le statut"
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3.5 text-sm font-bold transition-colors hover:border-[color:var(--stroke-hi)] disabled:opacity-60"
                      >
                        {inner}
                      </button>
                    ) : (
                      <span
                        key={p.playerId}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3.5 text-sm font-bold"
                      >
                        {inner}
                      </span>
                    );
                  })}
                </div>
              </div>
            )
        )}
      </div>

      {canManage && (
        <p className="mt-3 text-[11px] text-[color:var(--ink-2)]">
          Touche un joueur pour changer son statut : présent → peut-être →
          absent.
        </p>
      )}
    </div>
  );
}
