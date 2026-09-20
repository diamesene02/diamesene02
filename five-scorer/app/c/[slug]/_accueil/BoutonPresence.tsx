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
//
// Un abonné sans réponse est déjà compté présent (lib/presences) : lui
// proposer « Je serai là » lui faisait croire qu'il n'était pas inscrit, sous
// une bannière qui le comptait. Il voit donc « Présent · abonné », et c'est à
// la soirée qu'il se désiste.
export default function BoutonPresence({
  slug,
  matchDayId,
  playerId,
  initial,
  abonne = false,
  enAttente = false,
}: {
  slug: string;
  matchDayId: string;
  playerId: string;
  /// Sa réponse EXPLICITE, s'il en a donné une.
  initial: RsvpStatus | null;
  abonne?: boolean;
  /// Présent, mais au-delà des places : sur la liste d'attente.
  enAttente?: boolean;
}) {
  const [statut, setStatut] = useState<RsvpStatus | null>(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const retenu = statut ?? (abonne ? "IN" : null);
  if (retenu) {
    // La liste d'attente ne vaut que pour la réponse qu'on a reçue : après un
    // tap sur « Je serai là », la place n'est pas connue avant le rechargement.
    const attente = enAttente && retenu === "IN" && statut === initial;
    return (
      <Link
        href={`/c/${slug}/sessions/${matchDayId}`}
        className="accueil-statut"
        data-statut={attente ? "MAYBE" : retenu}
      >
        {attente ? "En attente" : LIBELLES[retenu]}
        {/* Espace insécable : en tête d'un élément flex, une espace
            ordinaire disparaît. */}
        {!statut && <span className="via">{" · abonné"}</span>}
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
