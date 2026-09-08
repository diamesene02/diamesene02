"use client";

import { useState } from "react";

/// Le résumé de la soirée, prêt à coller sur le groupe.
///
/// Le club vit sur WhatsApp : c'est là que les équipes se décident et que les
/// résultats se racontent. L'app enregistrait tout et ne rendait rien — il
/// fallait retaper le score à la main dans la conversation, ou ne rien dire.
///
/// Le texte est composé côté serveur, où sont les données. Ici on ne fait que
/// le mettre dans le presse-papier, ou l'ouvrir dans le partage du téléphone
/// quand il existe.
export default function MotDeLaSoiree({ texte }: { texte: string }) {
  const [etat, setEtat] = useState<string | null>(null);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setEtat("Copié — plus qu'à coller sur le groupe.");
    } catch {
      // Pas de presse-papier (contexte non sécurisé, permission refusée) :
      // on montre le texte pour qu'il reste sélectionnable à la main.
      setEtat(null);
      window.prompt("Le mot de la soirée :", texte);
    }
  };

  const partager = async () => {
    if (!navigator.share) return copier();
    try {
      await navigator.share({ text: texte });
      setEtat(null);
    } catch {
      /* partage annulé : rien à dire */
    }
  };

  return (
    <div className="mot-soiree">
      <pre className="apercu">{texte}</pre>
      <div className="actions">
        <button type="button" onClick={partager} className="plein">
          Envoyer sur le groupe
        </button>
        <button type="button" onClick={copier} className="verre grand">
          Copier
        </button>
      </div>
      {etat && <p className="etat">{etat}</p>}
    </div>
  );
}
