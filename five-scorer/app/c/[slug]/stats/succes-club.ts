import { RANG_MATIERE } from "@/lib/succes-icones";
import {
  FAMILLES,
  matiereDuPalier,
  type Badge,
  type IconeSucces,
  type Matiere,
} from "@/lib/succes";

// Les succès du club vus de la page Stats : les plus rares, et le fil
// regroupé. Pur : il se teste sans base.

export type Rarete = {
  badgeId: string;
  nom: string;
  icone: IconeSucces;
  matiere: Matiere;
  /// Rang du palier le plus haut détenu dans le club.
  palier: number;
  /// « 25 buts » : ce palier-là.
  libelle: string;
  detenteurs: { playerId: string; nom: string }[];
  /// Le nombre de joueurs parmi lesquels on compte.
  total: number;
};

/// Les succès les plus rares du club, au palier le plus haut que quelqu'un y
/// détient.
///
/// La rareté du contrat (`Badge.rarete`) se lit au PREMIER palier. Dans un
/// club qui tourne depuis deux saisons, tout le monde a son « Buteur »
/// bronze ; ce qui se raconte, c'est l'or que Bakary est seul à avoir. On
/// compte donc, famille par famille, qui tient le palier le plus haut.
///
/// `joueurs` : ceux qui comptent (`SuccesClub.niveaux` — ni invités, ni
/// archivés, ni joueurs à zéro). Une famille que la moitié du club détient
/// n'est pas rare : elle n'est pas listée.
export function plusRares(
  joueurs: readonly { playerId: string; nom: string }[],
  badgesDe: (playerId: string) => readonly Pick<Badge, "id" | "palier">[] | undefined,
  max = 5,
): Rarete[] {
  const total = joueurs.length;
  if (total === 0) return [];
  const parFamille = new Map<string, { palier: number; detenteurs: { playerId: string; nom: string }[] }>();
  for (const j of joueurs) {
    for (const b of badgesDe(j.playerId) ?? []) {
      if (b.palier <= 0) continue;
      const f = parFamille.get(b.id);
      if (!f || b.palier > f.palier) {
        parFamille.set(b.id, { palier: b.palier, detenteurs: [{ playerId: j.playerId, nom: j.nom }] });
      } else if (b.palier === f.palier) {
        f.detenteurs.push({ playerId: j.playerId, nom: j.nom });
      }
    }
  }

  // Construite dans l'ordre du catalogue : le tri est stable, c'est lui
  // qui départage en dernier.
  const liste: Rarete[] = [];
  for (const f of FAMILLES) {
    const r = parFamille.get(f.id);
    if (!r || r.detenteurs.length * 2 > total) continue;
    liste.push({
      badgeId: f.id,
      nom: f.nom,
      icone: f.icone,
      matiere: matiereDuPalier(r.palier, f.paliers.length),
      palier: r.palier,
      libelle: f.libelle(f.paliers[r.palier - 1]),
      detenteurs: r.detenteurs,
      total,
    });
  }

  // Le moins détenu d'abord ; à égalité, le métal le plus précieux.
  return liste
    .sort(
      (a, b) =>
        a.detenteurs.length - b.detenteurs.length ||
        RANG_MATIERE[b.matiere] - RANG_MATIERE[a.matiere],
    )
    .slice(0, max);
}

// Le regroupement du fil et le nommage sont partis dans `lib/succes-fil.ts` :
// l'accueil du site les veut aussi, et sous `app/` aucun test ne peut les
// lire. Ré-exportés ici pour que la page Stats les prenne au même endroit
// qu'avant.
export { grouperFil, nommer, type LigneFil } from "@/lib/succes-fil";
