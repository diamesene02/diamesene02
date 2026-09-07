"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// Un chiffre qui CHANGE physiquement, au lieu de se fondre.
//
// Le nouveau entre par le bas pendant que l'ancien sort par le haut, dans une
// boîte à hauteur fixe — c'est le geste d'un tableau d'affichage, et c'est ce
// qui fait sentir qu'un but vient de tomber. Sur le panneau, il entre en plus
// en se COMPRIMANT (chasse 100 % → 62 %) : l'axe de chasse d'Archivo est le
// levier qu'Apple Sports utilise pour ses scores. Transform, opacity et un axe
// de fonte variable : rien qui coûte une mise en page.
//
// Respecte prefers-reduced-motion (le CSS neutralise les animations) et ne
// joue JAMAIS au montage : un score qui apparaît n'est pas un but.

export default function ChiffreRoulant({
  value,
  className,
  compress = false,
}: {
  value: number;
  className?: string;
  /// Compression de la chasse à l'entrée — réservée au chiffre du panneau.
  compress?: boolean;
}) {
  const [courant, setCourant] = useState(value);
  const [sortant, setSortant] = useState<number | null>(null);
  const monte = useRef(false);

  useEffect(() => {
    if (!monte.current) {
      monte.current = true;
      return;
    }
    if (value === courant) return;
    setSortant(courant);
    setCourant(value);
    const t = setTimeout(() => setSortant(null), 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={cn("chiffre-roulant", className)} aria-label={String(value)}>
      {sortant !== null && (
        <span key={"s" + sortant} className="chiffre-roulant-sort" aria-hidden>
          {sortant}
        </span>
      )}
      <span
        key={"c" + courant}
        className={cn(
          "chiffre-roulant-courant",
          sortant !== null && "entre",
          compress && "comprime"
        )}
      >
        {courant}
      </span>
    </span>
  );
}
