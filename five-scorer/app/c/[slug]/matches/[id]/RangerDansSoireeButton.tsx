"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rattacherMatch } from "@/app/actions/matches";

/// « Ranger dans la soirée du lundi … » — le geste qui ferme le cul-de-sac.
///
/// Les trois écrans qui réclamaient une feuille mènent désormais ici quand un
/// match du bon jour existe sans soirée. Ce bouton est ce qu'ils promettent.
///
/// **Ouvert à qui peut scorer** (spec 0007) : le marqueur du lundi soir peut
/// fabriquer un orphelin — il doit pouvoir le ranger, sans attendre un admin
/// le mardi. Le refus vient du serveur, pas d'ici ; cet écran ne fait que
/// l'afficher (article V : un refus se dit).
///
/// Sans confirmation : ranger un match n'efface rien et se défait par le même
/// chemin (le champ « Soirée » du formulaire d'édition, option « Aucune —
/// match isolé »). Une confirmation à deux temps est réservée aux gestes qui
/// ne se rattrapent pas.
export default function RangerDansSoireeButton({
  slug,
  matchId,
  soireeId,
  libelle,
}: {
  slug: string;
  matchId: string;
  soireeId: string;
  libelle: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="accueil-rattrapage">
      <div className="titre">Ce match n&apos;appartient à aucune soirée</div>
      <button
        type="button"
        className="rangee"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await rattacherMatch(slug, matchId, soireeId);
            if (!res.ok) {
              setError(res.error ?? "Le rangement n'a pas abouti.");
              return;
            }
            router.refresh();
          })
        }
      >
        <span className="quand">{libelle}</span>
        <span className="acte">
          {pending ? "On range…" : "Ranger le match ici"}
        </span>
      </button>
      {error && (
        <p className="accueil-vide" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
