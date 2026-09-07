import LigneScore from "@/components/ios/LigneScore";

// Le score a UN dessin dans toute l'app — celui de la maquette : écusson et
// nom de chaque chasuble aux bords, chiffres lourds, perdant grisé, état au
// centre. Le composant garde son ancienne signature (a, b, scoreA, scoreB,
// fini, pied) pour que l'accueil, la soirée, l'historique et le récap n'aient
// rien à changer.
export default function Panneau({
  a,
  b,
  scoreA,
  scoreB,
  fini = false,
  className,
  pied,
  heure,
  href,
}: {
  a: string;
  b: string;
  scoreA: number;
  scoreB: number;
  taille?: "panneau" | "ligne" | "ticker";
  fini?: boolean;
  className?: string;
  pied?: React.ReactNode;
  heure?: React.ReactNode;
  href?: string;
}) {
  return (
    <LigneScore
      nomA={a}
      nomB={b}
      scoreA={scoreA}
      scoreB={scoreB}
      etat={fini ? "Terminé" : "En direct"}
      direct={!fini}
      heure={heure}
      pied={pied}
      href={href}
      className={className}
    />
  );
}
