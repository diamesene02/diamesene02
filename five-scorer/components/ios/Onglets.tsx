"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

// Les onglets texte en tête de carte : « Lundi 31 · Ce soir · À venir »,
// « Tableau · Buteurs · Forme ». Le contenu de chaque onglet est rendu par le
// serveur et passé tel quel ; seul le choix vit ici.
export default function Onglets({
  onglets,
  initial,
  className,
}: {
  onglets: { id: string; label: string; contenu: React.ReactNode }[];
  initial?: string;
  className?: string;
}) {
  const [actif, setActif] = useState(initial ?? onglets[0]?.id);
  const courant = onglets.find((o) => o.id === actif) ?? onglets[0];
  const index = Math.max(
    0,
    onglets.findIndex((o) => o.id === courant?.id),
  );
  return (
    <div className={className}>
      {/* --n et --i portent le trait qui suit l'onglet choisi (globals.css,
          lot « mouvement »). Le compter en CSS évite un élément de plus et
          une mesure au rendu : les colonnes sont égales, l'index suffit. */}
      <div
        className="onglets"
        role="tablist"
        style={{ "--n": onglets.length, "--i": index } as React.CSSProperties}
      >
        {onglets.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={o.id === courant?.id}
            onClick={() => setActif(o.id)}
            className={cn("onglet", o.id === courant?.id && "actif")}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="filet" />
      {/* La clé remonte le panneau à chaque changement : le fondu court
          rejoue, et surtout deux panneaux de même forme ne se recyclent
          plus l'un dans l'autre en gardant l'état du précédent. */}
      <div key={courant?.id} role="tabpanel" className="onglet-panneau">
        {courant?.contenu}
      </div>
    </div>
  );
}
