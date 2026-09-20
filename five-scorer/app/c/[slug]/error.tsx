"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// Quand une page du club ne se rend pas.
//
// Sans ce fichier, une exception serveur affichait la page d'erreur générique
// de Next, en anglais, sans autre issue que le bouton retour du navigateur.
// Au bord du terrain, la cause est presque toujours le réseau : on le dit, et
// on propose de réessayer sur place.
export default function ErreurClub({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { slug } = useParams<{ slug: string }>();
  // Lu après le montage : le serveur ne sait rien du réseau du téléphone.
  const [horsLigne, setHorsLigne] = useState(false);
  useEffect(() => {
    console.error(error);
    setHorsLigne(!navigator.onLine);
  }, [error]);

  return (
    <main className="ecran">
      <section className="carte erreur-club">
        <div className="carte-titre">
          {horsLigne ? "Pas de réseau" : "Cette page n'a pas chargé"}
        </div>
        <p className="texte">
          {horsLigne
            ? "Le téléphone est hors ligne. Un match en cours reste enregistré dessus ; cette page reviendra avec le réseau."
            : "Souci de réseau ou de serveur. Réessaie dans un instant."}
        </p>
        {error.digest && <p className="code">Référence : {error.digest}</p>}
        <div className="actions">
          <button type="button" className="plein" onClick={() => unstable_retry()}>
            Réessayer
          </button>
          {slug && (
            <Link href={`/c/${slug}`} className="verre grand">
              Accueil du club
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
