import { cn } from "@/lib/cn";

// Le score a UN dessin dans toute l'app : bandes de chasuble aux bords, axe
// médian en craie, perdant en encre sourde — le même objet en trois tailles.
// Il remplace cinq écritures différentes du score, dont quatre avec un « : »
// et deux dont la couleur du vainqueur était un ternaire mort.
//
// `fini` : le match est terminé, la bande porte le résultat (18 px pour le
// vainqueur, 6 px pour le perdant). Un événement laisse une trace.

export default function Panneau({
  a,
  b,
  scoreA,
  scoreB,
  taille = "ligne",
  fini = false,
  className,
  pied,
}: {
  a: string;
  b: string;
  scoreA: number;
  scoreB: number;
  taille?: "panneau" | "ligne" | "ticker";
  fini?: boolean;
  className?: string;
  pied?: React.ReactNode;
}) {
  const aGagne = scoreA > scoreB;
  const bGagne = scoreB > scoreA;
  return (
    <div
      className={cn(
        "panneau-mini",
        taille,
        fini && "fini",
        fini && aGagne && "gagne-a",
        fini && bGagne && "gagne-b",
        className
      )}
    >
      <span className="panneau-mini-bande A" aria-hidden />
      <span className="panneau-mini-camp A">
        <span className="panneau-mini-code">{a}</span>
        <span className={cn("panneau-mini-score", bGagne && "perd")}>{scoreA}</span>
      </span>
      <span className="panneau-mini-axe" aria-hidden />
      <span className="panneau-mini-camp B">
        <span className="panneau-mini-code">{b}</span>
        <span className={cn("panneau-mini-score", aGagne && "perd")}>{scoreB}</span>
      </span>
      <span className="panneau-mini-bande B" aria-hidden />
      {pied && <span className="panneau-mini-pied">{pied}</span>}
    </div>
  );
}
