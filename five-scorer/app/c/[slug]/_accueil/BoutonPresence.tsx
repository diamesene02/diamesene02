"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setRsvp } from "@/app/actions/matchday";
import type { RsvpStatus } from "@prisma/client";

const LIBELLES: Record<RsvpStatus, string> = {
  IN: "Présent",
  MAYBE: "Peut-être",
  OUT: "Absent",
};

// « Je serai là » en un tap depuis l'accueil. Une fois répondu, le bouton
// devient le libellé de la réponse, qui mène à la soirée où l'on peut la
// changer — l'accueil n'est pas l'endroit pour trois boutons.
export default function BoutonPresence({
  slug,
  matchDayId,
  playerId,
  initial,
}: {
  slug: string;
  matchDayId: string;
  playerId: string;
  initial: RsvpStatus | null;
}) {
  const [statut, setStatut] = useState<RsvpStatus | null>(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (statut) {
    return (
      <Link
        href={`/c/${slug}/sessions/${matchDayId}`}
        className="accueil-statut"
        data-statut={statut}
      >
        {LIBELLES[statut]}
      </Link>
    );
  }

  const repondre = () => {
    setErreur(null);
    startTransition(async () => {
      const res = await setRsvp(slug, matchDayId, playerId, "IN");
      if (res.ok) setStatut("IN");
      else setErreur(res.error ?? "Erreur");
    });
  };

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={repondre}
        disabled={pending}
        className="plein"
      >
        {pending ? "…" : "Je serai là"}
      </button>
      {erreur && (
        <span className="text-[13px] text-[color:var(--bad)]">{erreur}</span>
      )}
    </span>
  );
}
