"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// La bannière de la soirée : le quand en gros, le lieu dessous, l'état en
// légende — trois rangs, trois tailles, dans l'ordre où on les lit. Elle
// disait tout sur une seule ligne de 21 px, qui passait sur deux lignes sous
// le ✕ et finissait par un point comme une phrase. L'app a pris cette forme
// le 22 septembre 2026, le site la reprend. Le ✕ la masque pour
// CETTE soirée seulement (clé par identifiant) : la semaine suivante, elle
// revient d'elle-même — c'est le rappel de la semaine, pas une pub qu'on
// ferme une fois pour toutes.
export default function Banniere({
  cle,
  href,
  titre,
  lieu,
  aide,
}: {
  cle: string;
  href: string;
  titre: string;
  /// Le lieu, sur son propre rang : c'est un nom propre, il ne se coupe pas.
  lieu?: string | null;
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
          {lieu && <span className="lieu block">{lieu}</span>}
          <span className="aide block">{aide}</span>
        </span>
      </Link>
      {/* Posé à côté du lien, pas dedans, et sur une zone de 44 px : un tap
          un peu court ouvrait la soirée au lieu de masquer la bannière. */}
      <button
        type="button"
        onClick={fermer}
        aria-label="Masquer pour cette soirée"
        className="accueil-fermer"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
