"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { retablirMatchAction } from "@/app/actions/matches";

/// Rétablir un match annulé — symétrique de `DeleteMatchButton` /
/// `CancelMatchButton`, mais sans confirmation à deux temps : un
/// rétablissement n'a pas la gravité d'une annulation ou d'une suppression
/// (spec 0001, Q8). `retablirMatchAction` refuse déjà tout ce qui n'est pas
/// CANCELED ; ce composant se contente d'afficher l'erreur, le cas échéant.
export default function RestoreMatchButton({
  slug,
  matchId,
}: {
  slug: string;
  matchId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await retablirMatchAction(slug, matchId);
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
        className="verre"
      >
        {pending ? "…" : "Rétablir"}
      </button>
      {error && (
        <p className="w-full text-right text-sm text-[color:var(--loss)]">
          {error}
        </p>
      )}
    </div>
  );
}
