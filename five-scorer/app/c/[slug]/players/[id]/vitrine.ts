import type { Badge, Serie } from "@/lib/succes";

// L'ordre de la vitrine des succès sur la fiche. Pur : il se teste sans base.
//
// Le moteur rend les familles dans l'ordre du catalogue, qui ne dit rien de
// ce qui intéresse le joueur. La fiche montre d'abord ce qui vient de tomber,
// puis ce qui est à portée — c'est ce qui fait revenir le lundi —, puis le
// reste de ce qui est acquis, et enfin ce qu'on n'a pas commencé.

/// « Vient de tomber » : les deux dernières soirées, pour qu'un palier du
/// lundi soit encore en tête le lundi suivant, avant d'être remplacé.
const RECENT_MS = 14 * 86_400_000;

/// Les familles qui retiennent une SÉRIE : leur proximité se lit sur la série
/// en cours, pas sur le record — un record de 4 ne met pas « à un pas » de 5
/// celui qui vient de perdre. Même règle que `SuccesJoueur.prochain`.
const SERIE_DE: Record<string, Serie["id"]> = {
  "serie-victoires": "victoires",
  invincible: "invincible",
  "buteur-en-serie": "buteur",
  "lundis-d-affilee": "lundis",
};

/// L'Élo part de 1 000 (lib/elo.ts) : mesuré depuis zéro, tout nouveau venu
/// serait « à 91 % » d'une cote de 1 100.
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
/// Le tri est stable : à égalité, l'ordre du catalogue départage, et deux
/// rafraîchissements ne se contredisent pas.
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

/// « Vient tous les lundis » — ou « à chaque soirée » quand le club n'a pas
/// de jour fixe.
///
/// Le libellé était écrit en dur, alors que le calendrier automatique laisse
/// choisir n'importe quel jour : un club du jeudi lisait « lundis » sur son
/// réglage le plus important. Le club n'enregistre pas son jour de jeu ; on
/// le lit dans ses soirées. `jours` : le jour de la semaine (« lundi », dans
/// le fuseau du club) des soirées les PLUS PROCHES d'aujourd'hui — celles à
/// venir tant qu'il y en a, la plus proche d'abord. Pas les plus anciennes
/// d'une fenêtre de trois mois : un club qui a changé de jour dirait encore
/// l'ancien.
export function libelleAbonnement(jours: readonly string[]): string {
  const [dernier] = jours;
  if (!dernier || jours.some((j) => j !== dernier)) return "Vient à chaque soirée";
  // Les sept jours prennent un « s » au pluriel.
  return `Vient tous les ${dernier}s`;
}
