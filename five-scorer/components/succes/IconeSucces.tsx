import { CHEMINS_ICONES, type IconeSucces as Cle } from "@/lib/succes-icones";

// Une icône de succès, seule. Elle hérite de `currentColor` : posée dans une
// médaille elle prend l'encre du métal, posée dans une ligne celle du texte.
export default function IconeSucces({
  icone,
  taille = 24,
  className,
  label,
}: {
  icone: Cle;
  taille?: number;
  className?: string;
  /// Décorative par défaut ; un libellé si elle porte seule le sens.
  label?: string;
}) {
  const chemins = CHEMINS_ICONES[icone] ?? CHEMINS_ICONES.etoile;
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {chemins.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
