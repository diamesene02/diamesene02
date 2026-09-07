import Link from "next/link";
import { cn } from "@/lib/cn";
import { lettre } from "@/lib/ini";
import Ecusson from "./Ecusson";

// LA ligne de score de l'app : écusson + nom, chiffre, état au centre,
// chiffre, écusson + nom. Le perdant est grisé, jamais rouge. Un match en
// direct porte le point rouge et l'horloge au centre ; un match terminé
// porte « Terminé » et son heure ; un match à venir n'a pas de chiffres.
export default function LigneScore({
  nomA,
  nomB,
  scoreA,
  scoreB,
  etat = "Terminé",
  heure,
  direct = false,
  aVenir = false,
  href,
  onClick,
  pied,
  className,
}: {
  nomA: string;
  nomB: string;
  scoreA?: number | null;
  scoreB?: number | null;
  etat?: React.ReactNode;
  heure?: React.ReactNode;
  direct?: boolean;
  aVenir?: boolean;
  href?: string;
  onClick?: () => void;
  pied?: React.ReactNode;
  className?: string;
}) {
  const a = scoreA ?? 0;
  const b = scoreB ?? 0;
  const aPerd = !aVenir && !direct && a < b;
  const bPerd = !aVenir && !direct && b < a;
  const corps = (
    <>
      <span className="camp">
        <Ecusson camp="A" lettre={lettre(nomA)} />
        <span className="nom">{nomA}</span>
      </span>
      {aVenir ? (
        <span />
      ) : (
        <span className={cn("chiffre", aPerd && "perd")}>
          <span className="score-lourd">{a}</span>
        </span>
      )}
      <span className="milieu">
        <span className={cn("etat", direct && "direct")}>{etat}</span>
        {heure && <span className="heure">{heure}</span>}
      </span>
      {aVenir ? (
        <span />
      ) : (
        <span className={cn("chiffre", bPerd && "perd")}>
          <span className="score-lourd">{b}</span>
        </span>
      )}
      <span className="camp">
        <Ecusson camp="B" lettre={lettre(nomB)} />
        <span className="nom">{nomB}</span>
      </span>
      {pied && <span className="pied">{pied}</span>}
    </>
  );
  if (href)
    return (
      <Link href={href} className={cn("ligne-score tape", className)}>
        {corps}
      </Link>
    );
  if (onClick)
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn("ligne-score tape", className)}
      >
        {corps}
      </button>
    );
  return <div className={cn("ligne-score", className)}>{corps}</div>;
}
