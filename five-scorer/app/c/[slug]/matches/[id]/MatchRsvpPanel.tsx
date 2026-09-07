"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { setMatchRsvp } from "@/app/actions/schedule";
import type { RsvpStatus } from "@prisma/client";

type Row = { playerId: string; name: string; status: RsvpStatus | null };

const LABELS: Record<RsvpStatus, string> = {
  IN: "Présent",
  MAYBE: "Peut-être",
  OUT: "Absent",
};

// Le mot suffit : la couleur ne fait que doubler l'information, jamais la
// porter seule.
const CHIP_LABELS: Record<RsvpStatus, string> = {
  IN: "Présent",
  MAYBE: "Peut-être",
  OUT: "Absent",
};

const NEXT: Record<"none" | RsvpStatus, RsvpStatus> = {
  none: "IN",
  IN: "MAYBE",
  MAYBE: "OUT",
  OUT: "IN",
};

function chipCls(status: RsvpStatus | null) {
  switch (status) {
    case "IN":
      return "border-[color:var(--bib-a)] bg-[color:var(--pitch-2)] text-[color:var(--bib-a-ink)]";
    case "MAYBE":
      return "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/10 text-[color:var(--gold)]";
    case "OUT":
      return "border-[color:var(--loss)]/60 bg-[color:var(--loss)]/10 text-[color:var(--loss)]";
    default:
      return "border-[color:var(--rule)] bg-[color:var(--pitch-2)] text-[color:var(--ink-2)]";
  }
}

/// Convocation d'un match programmé : tout le roster est listé, chacun répond
/// pour soi, les admins peuvent régler le statut de n'importe qui (chips
/// cyclantes : sans réponse → présent → peut-être → absent).
export default function MatchRsvpPanel({
  slug,
  matchId,
  myPlayerId,
  canManage,
  players,
}: {
  slug: string;
  matchId: string;
  myPlayerId: string | null;
  canManage: boolean;
  players: Row[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(players);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const mine = myPlayerId
    ? (rows.find((r) => r.playerId === myPlayerId)?.status ?? null)
    : null;

  function apply(playerId: string, status: RsvpStatus) {
    setError(null);
    // Optimiste : maj locale immédiate.
    setRows((prev) =>
      prev.map((r) => (r.playerId === playerId ? { ...r, status } : r))
    );
    startTransition(async () => {
      const res = await setMatchRsvp(slug, matchId, playerId, status);
      if (!res.ok) setError(res.error ?? "Erreur");
      else router.refresh();
    });
  }

  const ins = rows.filter((r) => r.status === "IN");
  const maybes = rows.filter((r) => r.status === "MAYBE");
  const outs = rows.filter((r) => r.status === "OUT");
  const silent = rows.filter((r) => r.status === null);

  return (
    <div>
      {myPlayerId && (
        <div className="flex gap-2">
          {(["IN", "MAYBE", "OUT"] as const).map((s) => (
            <button
              key={s}
              disabled={pending}
              onClick={() => apply(myPlayerId, s)}
              className={cn(
 "big-touch flex-1 rounded-none border px-3 py-2.5 text-sm font-bold transition-colors",
                mine === s
                  ? chipCls(s)
                  : "border-[color:var(--rule)] bg-[color:var(--pitch-2)] text-[color:var(--ink-1)] hover:border-[color:var(--rule-hi)]"
              )}
            >
              {LABELS[s]}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="mt-2 text-sm text-[color:var(--loss)]">{error}</p>
      )}

      {/* Compteurs */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm tabular-nums">
        <div>
          <span className="font-black text-[color:var(--bib-a-ink)]">
            {ins.length}
          </span>{" "}
          <span className="text-[color:var(--ink-2)]">présent·s</span>
        </div>
        <div>
          <span className="font-black text-[color:var(--gold)]">
            {maybes.length}
          </span>{" "}
          <span className="text-[color:var(--ink-2)]">peut-être</span>
        </div>
        <div>
          <span className="font-black text-[color:var(--loss)]">
            {outs.length}
          </span>{" "}
          <span className="text-[color:var(--ink-2)]">absent·s</span>
        </div>
        <div>
          <span className="font-black text-[color:var(--ink-1)]">
            {silent.length}
          </span>{" "}
          <span className="text-[color:var(--ink-2)]">sans réponse</span>
        </div>
      </div>

      {/* Liste complète du roster */}
      <ul className="mt-4 divide-y divide-[color:var(--rule)] overflow-hidden rounded-none border border-[color:var(--rule)] bg-[color:var(--pitch-2)]">
        {rows.map((r) => (
          <li
            key={r.playerId}
            className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2"
          >
            <span
              className={cn(
 "min-w-0 truncate text-sm font-bold",
                r.playerId === myPlayerId && "text-[color:var(--ink-1)]"
              )}
            >
              {r.name}
              {r.playerId === myPlayerId && (
                <span className="ml-1.5 text-[10px]  text-[color:var(--ink-2)]">
                  toi
                </span>
              )}
            </span>
            {canManage ? (
              <button
                disabled={pending}
                onClick={() => apply(r.playerId, NEXT[r.status ?? "none"])}
                title="Tape pour changer le statut"
                className={cn(
 "inline-flex min-h-[44px] shrink-0 items-center rounded-[2px] border px-4 text-[13px] font-semibold transition-colors",
                  chipCls(r.status)
                )}
              >
                {r.status ? CHIP_LABELS[r.status] : "Sans réponse"}
              </button>
            ) : (
              <span
                className={cn(
 "inline-flex min-h-[36px] shrink-0 items-center rounded-[2px] border px-4 text-[13px] font-semibold",
                  chipCls(r.status)
                )}
              >
                {r.status ? CHIP_LABELS[r.status] : "Sans réponse"}
              </span>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <p className="mt-2 text-[11px] text-[color:var(--ink-2)]">
          En tant qu&apos;admin, tape sur un statut pour répondre à la place
          d&apos;un joueur. Les présents seront présélectionnés à la compo.
        </p>
      )}
    </div>
  );
}
