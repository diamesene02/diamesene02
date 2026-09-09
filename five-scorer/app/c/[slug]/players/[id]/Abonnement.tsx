"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAbonnement } from "@/app/actions/roster";
import Interrupteur from "@/components/ios/Interrupteur";

/// « Je viens tous les lundis. »
///
/// L'inverse du modèle de départ : plutôt que de demander quinze réponses
/// chaque semaine — que personne ne donne —, on ne demande que les absences.
export default function Abonnement({
  slug,
  playerId,
  initial,
  estMoi,
  nom,
}: {
  slug: string;
  playerId: string;
  initial: boolean;
  estMoi: boolean;
  nom: string;
}) {
  const router = useRouter();
  const [abonne, setAbonne] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const basculer = (v: boolean) => {
    setErreur(null);
    setAbonne(v);
    startTransition(async () => {
      const res = await setAbonnement(slug, playerId, v);
      if (!res.ok) {
        setAbonne(!v);
        setErreur(res.error ?? "Erreur");
      } else {
        router.refresh();
      }
    });
  };

  return (
    <>
      <div className="fiche-ligne">
        <span className="l">
          Vient tous les lundis
          <span className="aide">
            Compté présent d&apos;office.{" "}
            {estMoi
              ? "Tu peux toujours te déclarer absent sur une soirée."
              : `${nom} peut toujours se déclarer absent sur une soirée.`}
          </span>
        </span>
        <Interrupteur
          on={abonne}
          onChange={basculer}
          disabled={pending}
          label="Vient tous les lundis"
        />
      </div>
      {erreur && (
        <p className="fiche-vide" style={{ color: "var(--bad)" }}>
          {erreur}
        </p>
      )}
    </>
  );
}
