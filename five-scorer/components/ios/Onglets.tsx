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
  return (
    <div className={className}>
      <div className="onglets" role="tablist">
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
      <div role="tabpanel">{courant?.contenu}</div>
    </div>
  );
}
