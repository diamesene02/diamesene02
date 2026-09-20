import Link from "next/link";
import { RANG_MATIERE } from "@/lib/succes-icones";
import type { DeblocageJoueur } from "@/lib/succes";
import AvatarAnneau from "@/components/ios/AvatarAnneau";
import Medaille from "@/components/succes/Medaille";
import "./debloques.css";

// « Débloqués pendant ce match » : les paliers que ce match a fait franchir,
// un joueur par ligne, chaque palier avec sa médaille.
//
// Un joueur par ligne plutôt qu'un palier : le premier match d'un joueur lui
// en donne souvent trois ou quatre d'un coup (premier match, premier but,
// première victoire) — autant de lignes qui répétaient son nom. Et au premier
// match d'un club, dix « Premiers pas » d'affilée.

/// Au-delà, le reste se déplie : le vote de l'homme du match suit, il ne
/// doit pas finir sous douze lignes de médailles.
const JOUEURS_VISIBLES = 5;

export type JoueurDuMatch = { photo: string | null; camp: "A" | "B" | null };

type Ligne = { playerId: string; nom: string; paliers: DeblocageJoueur[] };

/// Un joueur par ligne ; le plus beau métal d'abord, puis le plus de paliers,
/// puis le nom. Dans une ligne, les paliers du plus précieux au moins
/// précieux.
export function parJoueur(deblocages: readonly DeblocageJoueur[]): Ligne[] {
  const lignes = new Map<string, Ligne>();
  for (const d of deblocages) {
    const l = lignes.get(d.playerId) ?? { playerId: d.playerId, nom: d.joueur, paliers: [] };
    l.paliers.push(d);
    lignes.set(d.playerId, l);
  }
  const meilleur = (l: Ligne) => Math.max(...l.paliers.map((d) => RANG_MATIERE[d.matiere]));
  for (const l of lignes.values()) {
    l.paliers.sort((a, b) => RANG_MATIERE[b.matiere] - RANG_MATIERE[a.matiere]);
  }
  return [...lignes.values()].sort(
    (a, b) =>
      meilleur(b) - meilleur(a) ||
      b.paliers.length - a.paliers.length ||
      a.nom.localeCompare(b.nom, "fr"),
  );
}

export default function DebloquesDuMatch({
  slug,
  deblocages,
  joueurs,
}: {
  slug: string;
  deblocages: readonly DeblocageJoueur[];
  /// Photo et chasuble de chacun sur CE match, pour l'avatar.
  joueurs: Map<string, JoueurDuMatch>;
}) {
  const lignes = parJoueur(deblocages);
  if (lignes.length === 0) return null;

  // Chaque palier garde sa médaille à côté de son libellé : empilées à
  // droite, trois médailles et une phrase de quatre libellés ne se
  // répondaient plus — on ne savait pas laquelle était l'or.
  const ligne = (l: Ligne) => {
    const j = joueurs.get(l.playerId);
    return (
      <Link key={l.playerId} href={`/c/${slug}/players/${l.playerId}#succes`} className="debloque">
        <AvatarAnneau nom={l.nom} photo={j?.photo} camp={j?.camp ?? null} taille={40} />
        <span className="textes">
          <span className="nom">{l.nom}</span>
          <span className="paliers">
            {l.paliers.map((d) => (
              <span key={`${d.badgeId}:${d.palier}`} className="palier">
                <Medaille icone={d.icone} matiere={d.matiere} taille={24} />
                {d.libelle}
              </span>
            ))}
          </span>
        </span>
      </Link>
    );
  };

  const tete = lignes.slice(0, JOUEURS_VISIBLES);
  const suite = lignes.slice(JOUEURS_VISIBLES);

  return (
    <section className="carte recap-debloques">
      <div className="carte-titre">Débloqués pendant ce match</div>
      <div className="corps">
        {tete.map(ligne)}
        {suite.length > 0 && (
          <details className="plus">
            <summary>
              <span className="ouvrir">
                {suite.length === 1 ? "Voir l'autre joueur" : `Voir les ${suite.length} autres joueurs`}
              </span>
              <span className="fermer">Masquer</span>
            </summary>
            {suite.map(ligne)}
          </details>
        )}
      </div>
    </section>
  );
}
