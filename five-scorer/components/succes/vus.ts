import { RANG_MATIERE, type Matiere } from "@/lib/succes-icones";

// Ce que CET appareil a déjà annoncé à un joueur — localStorage, sous
// `fs-succes-vus:<clubId>:<playerId>`.
//
// L'état vit sur l'appareil et pas en base (contrat des succès, principe 2) :
// un succès se RECALCULE à chaque chargement, et une correction de feuille
// peut le retirer puis le rendre. On retient donc des clés `<badgeId>:<palier>`,
// jamais des dates, et on n'annonce que ce qui APPARAÎT — une perte ne se dit
// pas.
//
// Trois règles, dans cet ordre :
// 1. Premier passage (rien d'enregistré) : tout ce qui est acquis se marque
//    vu en silence. Sinon, le jour de la mise en ligne, trente annonces.
// 2. Ce qui est plus ancien que le premier passage, moins une semaine, ne
//    s'annonce pas non plus : un palier ajouté plus tard au catalogue, ou une
//    famille nouvelle, ne doit pas déterrer un exploit de l'an dernier. La
//    semaine couvre la feuille restée ouverte et la soirée saisie après coup.
// 3. D'une même famille, on n'annonce que le palier le plus haut : « 5 buts »
//    et « 10 buts » débloqués le même soir, c'est une seule nouvelle.
//
// Sans stockage (navigation privée, quota, stockage bloqué), rien ne lève :
// la lecture rend `null`, le premier passage se rejoue à chaque visite, et on
// n'annonce jamais rien. Mieux vaut se taire que répéter.
//
// La même logique, testée, vit dans five-scorer-mobile/lib/succes-vus.ts.

export type EtatVus = { depuis: string; cles: string[] };

type DeblocageVu = { badgeId: string; palier: number; matiere: Matiere; le: string };

/// Une semaine : la marge de la règle 2.
const MARGE_MS = 7 * 86_400_000;

export const cleVu = (d: { badgeId: string; palier: number }) => `${d.badgeId}:${d.palier}`;

const cleStockage = (clubId: string, playerId: string) => `fs-succes-vus:${clubId}:${playerId}`;

/// Les déblocages à annoncer, du plus récent au plus ancien — et, le même
/// jour, du plus précieux au moins précieux. Pur.
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

function lire(cle: string): EtatVus | null {
  try {
    const brut = window.localStorage.getItem(cle);
    if (!brut) return null;
    const v = JSON.parse(brut) as Partial<EtatVus>;
    if (typeof v?.depuis !== "string" || !Array.isArray(v.cles)) return null;
    return { depuis: v.depuis, cles: v.cles.filter((c): c is string => typeof c === "string") };
  } catch {
    return null;
  }
}

function ecrire(cle: string, etat: EtatVus): void {
  try {
    window.localStorage.setItem(cle, JSON.stringify(etat));
  } catch {
    // Stockage plein ou refusé : on se taira à la prochaine visite.
  }
}

export function lireVus(clubId: string, playerId: string): EtatVus | null {
  return lire(cleStockage(clubId, playerId));
}

/// Ajoute des clés à ce qui est vu. Jamais de retrait : un succès perdu puis
/// regagné ne se réannonce pas.
export function marquerVus(clubId: string, playerId: string, cles: readonly string[]): void {
  const k = cleStockage(clubId, playerId);
  const etat = lire(k) ?? { depuis: new Date().toISOString(), cles: [] };
  const tout = new Set(etat.cles);
  for (const c of cles) tout.add(c);
  ecrire(k, { depuis: etat.depuis, cles: [...tout] });
}

/// Ce qu'il faut annoncer maintenant. Au premier passage, marque tout en
/// silence et ne rend rien. Ne marque PAS ce qu'elle rend : c'est à l'annonce
/// de le faire, une fois montrée.
export function nouveauxDeblocages<D extends DeblocageVu>(
  clubId: string,
  playerId: string,
  deblocages: readonly D[],
): D[] {
  const etat = lireVus(clubId, playerId);
  if (!etat) {
    marquerVus(clubId, playerId, deblocages.map(cleVu));
    return [];
  }
  return aAnnoncer(deblocages, etat);
}
