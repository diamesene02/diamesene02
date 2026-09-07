"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { setRsvp } from "@/app/actions/matchday";
import type { RsvpStatus } from "@prisma/client";

type RsvpRow = { playerId: string; name: string; status: RsvpStatus };

const LABELS: Record<RsvpStatus, string> = {
  IN: "Présent",
  MAYBE: "Peut-être",
  OUT: "Absent",
};

export default function RsvpPanel({
  slug,
  matchDayId,
  myPlayerId,
  canManage,
  rsvps,
}: {
  slug: string;
  matchDayId: string;
  myPlayerId: string | null;
  canManage: boolean;
  rsvps: RsvpRow[];
}) {
  const [rows, setRows] = useState(rsvps);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const mine = myPlayerId
    ? rows.find((r) => r.playerId === myPlayerId)?.status ?? null
    : null;

  function respond(status: RsvpStatus) {
    if (!myPlayerId) return;
    setError(null);
    // Optimiste : maj locale immédiate.
    setRows((prev) => {
      const others = prev.filter((r) => r.playerId !== myPlayerId);
      const me = prev.find((r) => r.playerId === myPlayerId);
      return [
        ...others,
        { playerId: myPlayerId, name: me?.name ?? "Moi", status },
      ];
    });
    startTransition(async () => {
      const res = await setRsvp(slug, matchDayId, myPlayerId, status);
      if (!res.ok) setError(res.error ?? "Erreur");
    });
  }

  const ins = rows.filter((r) => r.status === "IN");
  const maybes = rows.filter((r) => r.status === "MAYBE");
  const outs = rows.filter((r) => r.status === "OUT");

  return (
    <div className="mt-4">
      {myPlayerId && (
        <div className="flex gap-2">
          {(["IN", "MAYBE", "OUT"] as const).map((s) => (
            <button
              key={s}
              disabled={pending}
              onClick={() => respond(s)}
              className={cn(
 "big-touch flex-1 rounded-none border px-3 py-2.5 text-sm font-bold transition-colors",
                mine === s
                  ? s === "IN"
                    ? "border-[color:var(--bib-a)] bg-[color:var(--pitch-2)] text-[color:var(--bib-a-ink)]"
                    : s === "OUT"
                      ? "border-[color:var(--loss)] bg-[color:var(--pitch-2)] text-[color:var(--loss)]"
                      : "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/10 text-[color:var(--gold)]"
                  : "border-[color:var(--rule)] bg-[color:var(--pitch-2)] text-[color:var(--ink-1)] hover:border-[color:var(--rule-hi)]"
              )}
            >
              {LABELS[s]}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-[color:var(--loss)]">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div>
          <span className="font-black text-[color:var(--bib-a-ink)]">
            {ins.length}
          </span>{" "}
          <span className="text-[color:var(--ink-2)]">présent·s</span>
          {ins.length > 0 && (
            <span className="ml-2 text-[color:var(--ink-1)]">
              {ins.map((r) => r.name).join(", ")}
            </span>
          )}
        </div>
        {maybes.length > 0 && (
          <div>
            <span className="font-black text-[color:var(--gold)]">
              {maybes.length}
            </span>{" "}
            <span className="text-[color:var(--ink-2)]">peut-être</span>
          </div>
        )}
        {outs.length > 0 && (
          <div>
            <span className="font-black text-[color:var(--loss)]">{outs.length}</span>{" "}
            <span className="text-[color:var(--ink-2)]">absent·s</span>
          </div>
        )}
      </div>
      {canManage && (
        <p className="mt-2 text-[11px] text-[color:var(--ink-2)]">
          Facultatif. Les équipes se préparent sur la soirée, présences ou
          non — c&apos;est elles que le coup d&apos;envoi utilise.
        </p>
      )}
    </div>
  );
}
