import Link from "next/link";
import { cn } from "@/lib/cn";
import { NOMS_MATIERES } from "@/lib/succes-icones";
import Medaille from "./Medaille";
import { dateCourte, resteAvantPalier } from "./textes";
import type { BadgeAffiche } from "./types";
import "./succes.css";

// Une famille de succès dans la grille : la médaille, le nom, et une seule
// ligne — ce qu'il reste à faire, ou la date quand tout est pris. La matière
// dit déjà où on en est ; l'écrire en plus doublerait l'information.
export default function TuileBadge({
  badge,
  href,
  nouveau = false,
  className,
}: {
  badge: BadgeAffiche;
  /// La tuile devient un lien (vers le match qui l'a débloquée, par exemple).
  href?: string;
  /// Une pastille « Nouveau », pour ce qui vient d'être annoncé.
  nouveau?: boolean;
  className?: string;
}) {
  const reste = resteAvantPalier(badge);
  const sous =
    reste ??
    (badge.obtenuLe ? `obtenu le ${dateCourte(badge.obtenuLe)}` : "tous les paliers");
  const etat = badge.matiere ? NOMS_MATIERES[badge.matiere] : "à débloquer";
  const label = `${badge.nom}, ${etat}, ${sous}`;
  const contenu = (
    <>
      <Medaille icone={badge.icone} matiere={badge.matiere} taille={56} />
      {nouveau && <span className="tuile-nouveau">Nouveau</span>}
      <span className="tuile-nom">{badge.nom}</span>
      <span className="tuile-sous">{sous}</span>
    </>
  );
  const classes = cn("tuile-badge", badge.palier === 0 && "verrouillee", className);
  return href ? (
    <Link href={href} className={classes} aria-label={label}>
      {contenu}
    </Link>
  ) : (
    <div className={classes} role="group" aria-label={label}>
      {contenu}
    </div>
  );
}
