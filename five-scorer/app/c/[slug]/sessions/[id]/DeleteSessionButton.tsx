"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMatchDay } from "@/app/actions/matchday";

export default function DeleteSessionButton({
  slug,
  matchDayId,
}: {
  slug: string;
  matchDayId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg px-4 py-2 text-sm font-bold text-[color:var(--loss)] hover:bg-[color:var(--bg-2)]"
      >
        Supprimer la soirée
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-[color:var(--ink-2)]">
        Sûr ? Les RSVP partent avec.
      </span>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await deleteMatchDay(slug, matchDayId);
            if (!res.ok) {
              setError(res.error ?? "Erreur");
              return;
            }
            router.push(`/c/${slug}/sessions`);
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
      {error && <span className="text-sm text-[color:var(--loss)]">{error}</span>}
    </div>
  );
}
