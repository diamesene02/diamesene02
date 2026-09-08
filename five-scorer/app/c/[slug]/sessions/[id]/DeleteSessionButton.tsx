"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMatchDay } from "@/app/actions/matchday";

// L'action destructrice tout en bas de l'écran, comme sur iOS : un bouton
// plein en rouge, puis la question et deux réponses — jamais un tap direct.
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
      <div className="soiree-danger">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="plein danger"
        >
          Supprimer la soirée
        </button>
      </div>
    );
  }
  return (
    <div className="soiree-danger">
      <p className="question">Sûr ? Les réponses partent avec.</p>
      <div className="confirm">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="verre grand"
        >
          Non
        </button>
        <button
          type="button"
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
          className="plein danger"
        >
          {pending ? "…" : "Oui, supprimer"}
        </button>
      </div>
      {error && <p className="erreur">{error}</p>}
    </div>
  );
}
