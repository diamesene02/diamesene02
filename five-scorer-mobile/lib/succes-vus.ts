// Ce que CE téléphone a déjà annoncé à un joueur — un petit fichier JSON par
// joueur et par club, dans le dossier Documents de l'app.
//
// L'état vit sur l'appareil et pas sur le serveur (contrat des succès,
// principe 2) : un succès se RECALCULE à chaque chargement, et une correction
// de feuille peut le retirer puis le rendre. On retient donc des clés
// `<badgeId>:<palier>`, jamais des dates, et on n'annonce que ce qui
// APPARAÎT — une perte ne se dit pas.
//
// Trois règles, dans cet ordre — les mêmes que le site
// (five-scorer/components/succes/vus.ts) :
// 1. Premier passage (aucun fichier) : tout ce qui est acquis se marque vu en
//    silence. Sinon, au lendemain de la mise à jour, trente annonces d'un coup.
// 2. Ce qui est plus ancien que le premier passage, moins une semaine, ne
//    s'annonce pas non plus : un palier ajouté plus tard au catalogue ne doit
//    pas déterrer un exploit de l'an dernier. La semaine couvre la feuille
//    restée ouverte et la soirée saisie après coup.
// 3. D'une même famille, seul le palier le plus haut s'annonce : « 5 buts » et
//    « 10 buts » débloqués le même soir, c'est une seule nouvelle.
//
// Rien ici ne lève. Un disque plein ou illisible donne `null` à la lecture,
// donc un premier passage silencieux à chaque ouverture : on n'annonce plus
// rien, ce qui vaut mieux que répéter la même annonce à chaque fois.
//
// Pas de table SQLite : ces clés ne partent jamais au serveur, n'ont rien à
// faire dans l'outbox, et un fichier se lit sans attendre l'ouverture de la
// base.

import { File, Paths } from "expo-file-system";
import { RANG_MATIERE, type Matiere } from "./succes-icones";

export type EtatVus = { depuis: string; cles: string[] };

type DeblocageVu = { badgeId: string; palier: number; matiere: Matiere; le: string };

/// Une semaine : la marge de la règle 2.
const MARGE_MS = 7 * 86_400_000;

export const cleVu = (d: { badgeId: string; palier: number }): string => `${d.badgeId}:${d.palier}`;

/// Les identifiants viennent du serveur (cuid) ; on ne laisse passer dans un
/// nom de fichier que ce qu'un cuid contient.
const propre = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "_");

function fichier(clubId: string, joueurId: string): File {
  return new File(Paths.document, `succes-vus-${propre(clubId)}-${propre(joueurId)}.json`);
}

/// Les déblocages à annoncer, du plus récent au plus ancien — et, le même
/// jour, du plus précieux au moins précieux. Pure : c'est elle que les tests
/// serrent.
export function aAnnoncer<D extends DeblocageVu>(deblocages: readonly D[], etat: EtatVus | null): D[] {
  if (!etat) return [];
  // Le plus haut palier vu, par famille : avoir vu « 10 buts » vaut avoir vu
  // « 5 buts ». Une correction qui fait redescendre un joueur d'un palier ne
  // lui annonce donc pas celui d'en dessous.
  const vuJusqua = new Map<string, number>();
  for (const c of etat.cles) {
    const i = c.lastIndexOf(":");
    const palier = Number(c.slice(i + 1));
    if (i <= 0 || !Number.isFinite(palier)) continue;
    const id = c.slice(0, i);
    vuJusqua.set(id, Math.max(vuJusqua.get(id) ?? 0, palier));
  }
  const depuis = Date.parse(etat.depuis);
  const plancher = Number.isNaN(depuis) ? -Infinity : depuis - MARGE_MS;
  const parFamille = new Map<string, D>();
  for (const d of deblocages) {
    if (d.palier <= (vuJusqua.get(d.badgeId) ?? 0)) continue;
    if (Date.parse(d.le) < plancher) continue;
    const deja = parFamille.get(d.badgeId);
    if (!deja || d.palier > deja.palier) parFamille.set(d.badgeId, d);
  }
  return [...parFamille.values()].sort((a, b) => {
    const ecart = (Date.parse(b.le) || 0) - (Date.parse(a.le) || 0);
    return ecart !== 0 ? ecart : RANG_MATIERE[b.matiere] - RANG_MATIERE[a.matiere];
  });
}

/// `null` : jamais passé sur ce téléphone (ou fichier illisible — même
/// traitement).
export async function lireVus(clubId: string, joueurId: string): Promise<EtatVus | null> {
  try {
    const f = fichier(clubId, joueurId);
    if (!f.exists) return null;
    const v = JSON.parse(await f.text()) as Partial<EtatVus>;
    if (typeof v?.depuis !== "string" || !Array.isArray(v.cles)) return null;
    return { depuis: v.depuis, cles: v.cles.filter((c): c is string => typeof c === "string") };
  } catch {
    return null;
  }
}

/// Ajoute des clés à ce qui est vu. Jamais de retrait : un succès perdu puis
/// regagné ne se réannonce pas.
export async function marquerVus(clubId: string, joueurId: string, cles: readonly string[]): Promise<void> {
  try {
    const etat = (await lireVus(clubId, joueurId)) ?? { depuis: new Date().toISOString(), cles: [] };
    const tout = new Set(etat.cles);
    for (const c of cles) tout.add(c);
    fichier(clubId, joueurId).write(JSON.stringify({ depuis: etat.depuis, cles: [...tout] }));
  } catch {
    // avalée, exprès : au pire, la même annonce reviendra une fois.
  }
}

/// Ce qu'il faut annoncer maintenant. Au premier passage, marque tout en
/// silence et ne rend rien. Ne marque PAS ce qu'elle rend : c'est à l'annonce
/// de le faire, une fois montrée.
export async function nouveauxDeblocages<D extends DeblocageVu>(
  clubId: string,
  joueurId: string,
  deblocages: readonly D[],
): Promise<D[]> {
  try {
    const etat = await lireVus(clubId, joueurId);
    if (!etat) {
      await marquerVus(clubId, joueurId, deblocages.map(cleVu));
      return [];
    }
    return aAnnoncer(deblocages, etat);
  } catch {
    return [];
  }
}
