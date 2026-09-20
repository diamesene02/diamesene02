import { cn } from "@/lib/cn";
import Ecusson from "@/components/ios/Ecusson";
import BarreProgression from "./BarreProgression";
import { nombre } from "./textes";
import type { NiveauAffiche } from "./types";
import "./succes.css";

// Le niveau d'un joueur : le chiffre dans l'écusson du club — le même que la
// pastille posée sur l'avatar de la fiche —, le titre, l'XP, et ce qui reste
// jusqu'au suivant. Le détail des XP est replié : on le lit une fois, pour
// comprendre, pas à chaque passage.
export default function CarteNiveau({
  niveau,
  detail,
  className,
}: {
  niveau: NiveauAffiche;
  /// `SuccesJoueur.xpDetail` : d'où viennent les points. Absent, rien ne se
  /// replie.
  detail?: { source: string; xp: number }[];
  className?: string;
}) {
  const suivant = niveau.niveau + 1;
  const reste = Math.max(0, niveau.xpSuivant - niveau.xp);
  const lignes = (detail ?? []).filter((d) => d.xp !== 0);
  return (
    <section className={cn("carte carte-niveau", className)}>
      <div className="niveau-tete">
        <Ecusson camp="A" lettre={String(niveau.niveau)} taille={56} />
        <div className="niveau-textes">
          <div className="niveau-titre">{niveau.titre}</div>
          <div className="niveau-sous">
            Niveau {niveau.niveau} · {nombre(niveau.xp)} XP
          </div>
        </div>
      </div>
      <BarreProgression
        part={niveau.progression}
        hauteur={6}
        label={`Vers le niveau ${suivant}`}
        className="niveau-barre"
      />
      <div className="niveau-reste">
        encore <b>{nombre(reste)} XP</b> pour le niveau {suivant}
      </div>
      {lignes.length > 0 && (
        <details className="niveau-detail">
          <summary>D'où viennent les XP</summary>
          <ul>
            {lignes.map((d) => (
              <li key={d.source}>
                <span>{d.source}</span>
                <span className="xp">{nombre(d.xp)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
