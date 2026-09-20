"use client";

import { useState } from "react";
import { texteConvocation, type EquipeConvoquee } from "@/lib/convocation";

/// « Envoyer sur le groupe » : la convocation, ou la compo si elle est faite.
///
/// Le club décide et annonce sur WhatsApp. Le partage du téléphone ouvre
/// directement la conversation ; sans lui (ordinateur), WhatsApp Web reçoit le
/// texte par wa.me. Le lien de la soirée est complété ici : seul le
/// navigateur connaît l'adresse par laquelle on est arrivé.
export default function EnvoyerSurLeGroupe({
  entete,
  etat,
  equipes,
  chemin,
  className = "verre",
  libelle = "Envoyer sur le groupe",
}: {
  entete: string;
  etat: string | null;
  equipes: EquipeConvoquee[];
  /// « /c/<slug>/sessions/<id> »
  chemin: string;
  className?: string;
  libelle?: string;
}) {
  const [retour, setRetour] = useState<string | null>(null);

  const envoyer = async () => {
    setRetour(null);
    const texte = texteConvocation({
      entete,
      etat,
      equipes,
      lien: window.location.origin + chemin,
    });
    if (navigator.share) {
      try {
        await navigator.share({ text: texte });
        return;
      } catch (e) {
        // Fermer la feuille de partage n'est pas une erreur.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    // Sans « noopener » dans les options : avec, window.open rend toujours
    // null et l'on ne saurait plus si la fenêtre s'est ouverte.
    const fenetre = window.open(
      `https://wa.me/?text=${encodeURIComponent(texte)}`,
      "_blank",
    );
    if (fenetre) {
      fenetre.opener = null;
      return;
    }
    // Fenêtre bloquée : le presse-papier, et à défaut le texte sous les yeux.
    try {
      await navigator.clipboard.writeText(texte);
      setRetour("Copié — plus qu'à coller sur le groupe.");
    } catch {
      window.prompt("À coller sur le groupe :", texte);
    }
  };

  return (
    <>
      <button type="button" onClick={envoyer} className={className}>
        {libelle}
      </button>
      {retour && (
        <p className="soiree-partage-etat" role="status">
          {retour}
        </p>
      )}
    </>
  );
}
