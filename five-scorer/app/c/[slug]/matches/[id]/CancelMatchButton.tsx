"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelScheduledMatch } from "@/app/actions/schedule";

export default function CancelMatchButton({
  slug,
  matchId,
}: {
  slug: string;
  matchId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-[2px] px-4 py-2 text-sm font-bold text-[color:var(--loss)] hover:bg-[color:var(--pitch-2)]"
      >
        Annuler ce match
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-[color:var(--ink-2)]">Sûr ?</span>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await cancelScheduledMatch(slug, matchId);
            if (!res.ok) setError(res.error ?? "Erreur");
            else router.refresh();
          })
        }
        className="rounded-[2px] bg-[color:var(--loss)] px-4 py-2 text-sm font-bold text-[color:var(--pitch-0)] disabled:opacity-50"
      >
        {pending ? "…" : "Oui, annuler"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="rounded-[2px] px-3 py-2 text-sm font-bold text-[color:var(--ink-1)]"
      >
        Non
      </button>
      {error && <p className="w-full text-sm text-[color:var(--loss)]">{error}</p>}
    </div>
  );
}
