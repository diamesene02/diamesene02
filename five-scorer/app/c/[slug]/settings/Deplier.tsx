"use client";

import { useState } from "react";

// Une ligne de réglage qui se déplie : le libellé, une valeur à droite, et
// l'outillage complet en dessous quand on la touche.
export default function Deplier({
  libelle,
  valeur,
  children,
}: {
  libelle: string;
  valeur?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button type="button" className="rangee-ios" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
        <span className="libelle">{libelle}</span>
        {valeur && <span className="valeur">{valeur}</span>}
        <span className="chevron">{ouvert ? "⌃" : "›"}</span>
      </button>
      {ouvert && <div className="reg-detail">{children}</div>}
    </>
  );
}
