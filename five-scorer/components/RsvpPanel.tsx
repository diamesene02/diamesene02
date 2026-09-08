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

// Ma réponse à une soirée, en une ligne : le segment Présent / Peut-être /
// Absent, puis le compte des réponses. Même vocabulaire que la carte
// « Ma réponse » de l'écran de la soirée.
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
        <div
          className="segment plein-large"
          role="radiogroup"
          aria-label="Ma réponse"
        >
          {(["IN", "MAYBE", "OUT"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={mine === s}
              disabled={pending}
              onClick={() => respond(s)}
              className={cn(mine === s && "actif")}
            >
              {LABELS[s]}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="mt-2 text-[15px] text-[color:var(--bad)]">{error}</p>
      )}

      <div className="mt-3 text-[17px] text-[color:var(--i2)]">
        <span className="font-semibold text-[color:var(--ink)]">
          {ins.length}
        </span>{" "}
        présent{ins.length > 1 ? "s" : ""}
        {maybes.length > 0 && (
          <>
            {" · "}
            <span className="font-semibold text-[color:var(--ink)]">
              {maybes.length}
            </span>{" "}
            peut-être
          </>
        )}
        {outs.length > 0 && (
          <>
            {" · "}
            <span className="font-semibold text-[color:var(--ink)]">
              {outs.length}
            </span>{" "}
            absent{outs.length > 1 ? "s" : ""}
          </>
        )}
        {ins.length > 0 && (
          <div className="mt-1 text-[15px] text-[color:var(--i2)]">
            {ins.map((r) => r.name).join(", ")}
          </div>
        )}
      </div>
      {canManage && (
        <p className="mt-2 text-[13px] text-[color:var(--i3)]">
          Facultatif. Les équipes se préparent sur la soirée, présences ou
          non — c&apos;est elles que le coup d&apos;envoi utilise.
        </p>
      )}
    </div>
  );
}
