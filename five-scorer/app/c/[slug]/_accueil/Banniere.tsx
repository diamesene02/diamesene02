"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// La bannière de la soirée : « Ce soir 20:30 — lieu. » Le ✕ la masque pour
// CETTE soirée seulement (clé par identifiant) : la semaine suivante, elle
// revient d'elle-même — c'est le rappel de la semaine, pas une pub qu'on
// ferme une fois pour toutes.
export default function Banniere({
  cle,
  href,
  titre,
  aide,
}: {
  cle: string;
  href: string;
  titre: string;
  aide: string;
}) {
  const stockage = `fs-banniere-${cle}`;
  const [masquee, setMasquee] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(stockage) === "1") setMasquee(true);
    } catch {}
  }, [stockage]);
  if (masquee) return null;
  const fermer = () => {
    try {
      localStorage.setItem(stockage, "1");
    } catch {}
    setMasquee(true);
  };
  return (
    <div className="accueil-banniere">
      <Link href={href} className="banniere">
        <span className="voile" />
        <span className="texte">
          <span className="titre block">{titre}</span>
          <span className="aide block">{aide}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={fermer}
        aria-label="Masquer"
        className="accueil-fermer"
      >
        ✕
      </button>
    </div>
  );
}
