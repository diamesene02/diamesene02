"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { annulerSoiree, retablirSoiree } from "@/app/actions/calendrier";

/// Annuler une soirée — ou la rétablir.
///
/// Le site ne savait que SUPPRIMER. Or la saison est posée d'un coup : une
/// soirée supprimée revient à la prochaine génération du calendrier, et ses
/// réponses partent avec. Un lundi férié, un terrain fermé, c'est une
/// annulation : la soirée reste au calendrier, marquée, avec son motif, et se
/// rétablit si le terrain rouvre.
export default function AnnulerSoiree({
  slug,
  matchDayId,
  annulee,
}: {
  slug: string;
  matchDayId: string;
  annulee: boolean;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const agir = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setErreur(null);
      const res = await fn();
      if (!res.ok) {
        setErreur(res.error ?? "Erreur");
        return;
      }
      setOuvert(false);
      router.refresh();
    });

  if (annulee) {
    return (
      <div className="soiree-danger">
        <button
          type="button"
          className="verre grand"
          disabled={pending}
          onClick={() => agir(() => retablirSoiree(slug, matchDayId))}
        >
          {pending ? "…" : "Rétablir la soirée"}
        </button>
        {erreur && <p className="erreur">{erreur}</p>}
      </div>
    );
  }

  if (!ouvert) {
    return (
      <div className="soiree-danger">
        <button type="button" className="verre grand" onClick={() => setOuvert(true)}>
          Annuler la soirée
        </button>
      </div>
    );
  }
  return (
    <div className="soiree-danger">
      <p className="question">
        Elle reste au calendrier, marquée annulée. Les réponses sont gardées.
      </p>
      <input
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
        placeholder="Motif (férié, terrain fermé…)"
        aria-label="Motif de l'annulation"
        maxLength={120}
        className="soiree-motif"
      />
      <div className="confirm">
        <button type="button" onClick={() => setOuvert(false)} className="verre grand">
          Non
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => agir(() => annulerSoiree(slug, matchDayId, motif))}
          className="plein danger"
        >
          {pending ? "…" : "Oui, annuler"}
        </button>
      </div>
      {erreur && <p className="erreur">{erreur}</p>}
    </div>
  );
}
