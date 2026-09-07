import { cn } from "@/lib/cn";

// L'écusson rond d'une chasuble : dégradé radial calculé depuis la couleur du
// club (--taG / --tbG), lettre en blanc ou noir selon la luminance.
export default function Ecusson({
  camp,
  lettre,
  taille = 60,
  className,
  style,
}: {
  camp: "A" | "B" | "club";
  lettre: string;
  taille?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn("ecusson", camp, className)}
      style={{
        width: taille,
        height: taille,
        fontSize: Math.round(taille * 0.4),
        ...style,
      }}
      aria-hidden
    >
      {lettre}
    </span>
  );
}
