// Ce que la fiche et les stats font des succès avant de les dessiner : l'ordre
// de la vitrine, le fil regroupé, les noms mis bout à bout, le sous-titre de
// la fiche. Pur, sans React : ça se teste sous Node.
//
// COPIE des règles du site (app/c/[slug]/players/[id]/vitrine.ts et
// app/c/[slug]/stats/succes-club.ts) : les deux écrans doivent montrer la
// même chose dans le même ordre. Un écart : les jours se comptent dans le
// fuseau du téléphone, comme tous les écrans de l'app, et pas dans celui du
// club.

import type { Badge, Deblocage, Niveau, Serie } from "../../lib/succes";

/// « Vient de tomber » : les deux dernières soirées, pour qu'un palier du
/// lundi soit encore en tête le lundi suivant, avant d'être remplacé.
const RECENT_MS = 14 * 86_400_000;

/// Les familles qui retiennent une SÉRIE : leur proximité se lit sur la série
/// en cours, pas sur le record — un record de 4 ne met pas « à un pas » de 5
/// celui qui vient de perdre.
const SERIE_DE: Record<string, Serie["id"]> = {
  "serie-victoires": "victoires",
  invincible: "invincible",
  "buteur-en-serie": "buteur",
  "lundis-d-affilee": "lundis",
};

/// L'Élo part de 1 000 : mesuré depuis zéro, tout nouveau venu serait « à
/// 91 % » d'une cote de 1 100.
const ELO_DEPART = 1000;

/// De 0 (rien de fait) à 1 (palier franchi) : la part du chemin vers le
/// prochain palier. 1 quand tout est pris.
export function proximite(
  b: Pick<Badge, "id" | "valeur" | "prochain">,
  enCours: Partial<Record<Serie["id"], number>>,
  elo: number | null,
): number {
  if (b.prochain == null) return 1;
  let part: number;
  if (b.id === "elo") {
    part = elo == null ? 0 : (elo - ELO_DEPART) / (b.prochain - ELO_DEPART);
  } else {
    const serie = SERIE_DE[b.id];
    const v = serie ? (enCours[serie] ?? 0) : b.valeur;
    part = v / b.prochain;
  }
  return Number.isFinite(part) ? Math.min(1, Math.max(0, part)) : 0;
}

type BadgeTri = Pick<Badge, "id" | "valeur" | "prochain" | "palier" | "obtenuLe">;

/// Les badges dans l'ordre de la vitrine :
///   0. obtenus depuis moins de deux semaines, le plus récent d'abord ;
///   1. en cours (un prochain palier, un début de chemin), le plus proche
///      d'abord ;
///   2. les autres acquis, du palier le plus haut au plus bas ;
///   3. ceux qu'on n'a pas commencés, dans l'ordre du catalogue.
/// Le tri est stable : à égalité, l'ordre du catalogue départage.
export function ordonnerBadges<T extends BadgeTri>(
  badges: readonly T[],
  opts: {
    series: readonly Pick<Serie, "id" | "enCours">[];
    elo: number | null;
    maintenant: Date;
  },
): T[] {
  const enCours: Partial<Record<Serie["id"], number>> = {};
  for (const s of opts.series) enCours[s.id] = s.enCours;
  const t = opts.maintenant.getTime();

  const cle = (b: T): [number, number] => {
    const obtenu = b.obtenuLe ? Date.parse(b.obtenuLe) : NaN;
    if (b.palier > 0 && Number.isFinite(obtenu) && t - obtenu <= RECENT_MS) {
      return [0, -obtenu];
    }
    const p = b.prochain == null ? 0 : proximite(b, enCours, opts.elo);
    if (b.prochain != null && p > 0) return [1, -p];
    if (b.palier > 0) return [2, -b.palier];
    return [3, 0];
  };

  return badges
    .map((b) => ({ b, k: cle(b) }))
    .sort((x, y) => x.k[0] - y.k[0] || x.k[1] - y.k[1])
    .map((x) => x.b);
}

/// Le jour civil d'un instant, dans le fuseau du téléphone.
function jourLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export type LigneFil<D extends Deblocage & { playerId: string; joueur: string }> = {
  cle: string;
  /// Le premier déblocage du groupe : le palier, la date, le match.
  d: D;
  joueurs: { playerId: string; nom: string }[];
};

/// Le fil, un palier par ligne plutôt qu'un joueur par ligne.
///
/// Le premier soir d'une saison, dix joueurs franchissent « Toujours là » au
/// même match : dix lignes identiques, et le triplé de la soirée tombait hors
/// du fil. Le même palier, le même jour, fait une seule ligne qui nomme tout
/// le monde. L'ordre du serveur (le plus récent d'abord) est gardé.
export function grouperFil<D extends Deblocage & { playerId: string; joueur: string }>(
  fil: readonly D[],
): LigneFil<D>[] {
  const lignes: LigneFil<D>[] = [];
  const index = new Map<string, LigneFil<D>>();
  for (const d of fil) {
    const cle = `${d.badgeId}:${d.palier}:${jourLocal(d.le)}`;
    const l = index.get(cle);
    if (l) {
      if (!l.joueurs.some((j) => j.playerId === d.playerId)) {
        l.joueurs.push({ playerId: d.playerId, nom: d.joueur });
      }
      continue;
    }
    const nouvelle = { cle, d, joueurs: [{ playerId: d.playerId, nom: d.joueur }] };
    index.set(cle, nouvelle);
    lignes.push(nouvelle);
  }
  return lignes;
}

/// « Bakary », « Bakary et Cédric », « Bakary, Cédric et Diame »,
/// « Bakary, Cédric et 3 autres ».
export function nommer(noms: readonly string[]): string {
  if (noms.length <= 1) return noms[0] ?? "";
  if (noms.length <= 3) return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
  return `${noms[0]}, ${noms[1]} et ${noms.length - 2} autres`;
}

/// Le sous-titre de la fiche, à la manière du site : « Orange · Titulaire ·
/// 3e du tableau (+2) ».
///
/// Le serveur écrit « Orange · Note 3 · 1er du tableau », où « Note 3 » est
/// la note d'équilibrage (1 à 5) que le capitaine donne. Le site l'a
/// remplacée par le titre du niveau des succès : deux chiffres sur la même
/// fiche ne disaient pas la même chose. La note reste là où elle sert,
/// l'effectif et la compo. Sans succès (serveur ancien), on rend le texte du
/// serveur tel quel.
///
/// « Niveau 3 » est accepté aussi : c'est ce que ce champ disait avant le
/// 20 septembre 2026, et l'app tourne contre le serveur qu'elle trouve.
export function sousTitreFiche(
  sousTitre: string,
  niveau: Pick<Niveau, "titre" | "xp"> | null,
  evolution: number | null,
): string {
  if (!niveau) return sousTitre;
  return sousTitre
    .split(" · ")
    .flatMap((morceau) => {
      if (/^(Niveau|Note) \d+$/.test(morceau)) return niveau.xp > 0 ? [niveau.titre] : [];
      if (/du tableau$/.test(morceau) && evolution) {
        return [`${morceau} (${evolution > 0 ? "+" : "−"}${Math.abs(evolution)})`];
      }
      return [morceau];
    })
    .join(" · ");
}
