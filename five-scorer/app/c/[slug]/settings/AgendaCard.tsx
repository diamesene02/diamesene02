"use client";

import { useEffect, useState } from "react";

/// L'abonnement iCal du club.
///
/// Le lien ne se tape pas : il se copie et se colle une fois dans l'agenda.
/// L'URL absolue se construit ICI, dans le navigateur, plutôt que côté
/// serveur — c'est le seul endroit qui connaisse à coup sûr le domaine par
/// lequel on est arrivé (app installée, aperçu Vercel, réseau local).
export default function AgendaCard({ token }: { token: string }) {
  const [base, setBase] = useState("");
  const [etat, setEtat] = useState<string | null>(null);
  useEffect(() => setBase(window.location.origin), []);

  const https = `${base}/api/cal/${token}.ics`;
  // webcal:// : les agendas d'iPhone et d'Android le reconnaissent et
  // proposent l'ABONNEMENT, là où un lien https télécharge un fichier figé
  // qui ne se mettra jamais à jour.
  const webcal = https.replace(/^https?:/, "webcal:");

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(https);
      setEtat("Lien copié.");
    } catch {
      window.prompt("Le lien de l'agenda :", https);
    }
  };

  return (
    <div className="reg-detail-corps">
      <p className="aide">
        Colle ce lien dans ton agenda : tous les lundis de la saison
        apparaissent, et ton téléphone te les rappelle tout seul. Il se met à
        jour quand le calendrier du club change.
      </p>
      <div className="agenda-actions">
        <a href={webcal} className="plein">
          Ajouter à mon agenda
        </a>
        <button type="button" onClick={copier} className="verre grand">
          Copier le lien
        </button>
      </div>
      <p className="aide">
        À partager avec tout le monde : le lien ne donne accès qu&apos;aux
        dates et au lieu, jamais aux joueurs ni aux résultats — et il ne permet
        pas de rejoindre le club.
      </p>
      {etat && <p className="aide">{etat}</p>}
    </div>
  );
}
