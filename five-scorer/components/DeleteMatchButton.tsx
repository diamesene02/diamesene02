"use client";

import { useState, useTransition } from "react";
import { deleteMatch } from "@/app/actions/matches";

export default function DeleteMatchButton({
  slug,
  matchId,
}: {
  slug: string;
  matchId: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg px-4 py-2 text-sm font-bold text-[color:var(--loss)] hover:bg-[color:var(--bg-2)]"
      >
        Supprimer
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[color:var(--ink-2)]">Sûr ?</span>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await deleteMatch(slug, matchId);
          })
        }
        className="rounded-lg bg-[color:var(--loss)] px-4 py-2 text-sm font-bold text-[color:var(--bg-0)] disabled:opacity-50"
      >
        {pending ? "…" : "Oui, supprimer"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="rounded-lg px-3 py-2 text-sm font-bold text-[color:var(--ink-1)]"
      >
        Non
      </button>
    </div>
  );
}
