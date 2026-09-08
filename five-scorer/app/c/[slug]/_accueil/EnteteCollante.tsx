"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// L'en-tête flou « Five Scorer » qui apparaît quand la grande barre du haut
// est partie hors écran. Il est collant à 0 et n'occupe aucune hauteur
// (marge négative) : on le rend visible non pas à un nombre de pixels
// arbitraire, mais au moment exact où il se colle — sinon, entre le seuil et
// le collage, il flottait quelques pixels sous le bord.
export default function EnteteCollante() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const lire = () => {
      const el = ref.current;
      if (!el) return;
      const colle = el.getBoundingClientRect().top <= 0.5 && window.scrollY > 60;
      setVisible((v) => (v === colle ? v : colle));
    };
    lire();
    window.addEventListener("scroll", lire, { passive: true });
    return () => window.removeEventListener("scroll", lire);
  }, []);
  return (
    <div
      ref={ref}
      className={cn("entete-collante accueil-entete", visible && "visible")}
      aria-hidden
    >
      Five Scorer
    </div>
  );
}
