import { cleJour, FUSEAU } from "@/lib/jour";
import type { BadgeAffiche } from "./types";

// Les mots des succès. Le moteur rend des nombres ; « encore 4 buts » demande
// de savoir ce qu'on compte, famille par famille. La table suit le catalogue
// du contrat (ids fixés) ; une famille inconnue retombe sur « encore 4 », qui
// reste juste.
//
// `record` : la famille retient un MAXIMUM (une soirée, une série, une cote),
// pas un cumul. « Encore 2 buts en une soirée » y serait faux — il faut les
// marquer tous le même soir — donc on y écrit le record et le palier visé.
// RECOPIÉE dans five-scorer-mobile/composants/succes/textes.ts.

type Unite = { un: string; des: string; record?: boolean };

const UNITES: Record<string, Unite> = {
  "premiers-pas": { un: "match", des: "matchs" },
  buteur: { un: "but", des: "buts" },
  passeur: { un: "passe", des: "passes" },
  double: { un: "doublé", des: "doublés" },
  triple: { un: "triplé", des: "triplés" },
  "soiree-de-buteur": { un: "but en une soirée", des: "buts en une soirée", record: true },
  "buteur-en-serie": { un: "soirée d'affilée", des: "soirées d'affilée", record: true },
  "homme-du-match": { un: "fois", des: "fois" },
  victoires: { un: "victoire", des: "victoires" },
  "serie-victoires": { un: "victoire d'affilée", des: "victoires d'affilée", record: true },
  invincible: { un: "match sans défaite", des: "matchs sans défaite", record: true },
  "roi-du-lundi": { un: "soirée gagnée", des: "soirées gagnées" },
  centurion: { un: "match", des: "matchs" },
  habitue: { un: "soirée", des: "soirées" },
  "lundis-d-affilee": { un: "soirée d'affilée", des: "soirées d'affilée", record: true },
  remontada: { un: "remontada", des: "remontadas" },
  "but-de-la-victoire": { un: "but décisif", des: "buts décisifs" },
  ouvreur: { un: "premier but", des: "premiers buts" },
  muraille: { un: "match aux cages", des: "matchs aux cages" },
  "clean-sheet": { un: "cage inviolée", des: "cages inviolées" },
  "victoire-large": { un: "large victoire", des: "larges victoires" },
  elo: { un: "point", des: "points", record: true },
  duo: { un: "but en duo", des: "buts en duo" },
  veteran: { un: "saison", des: "saisons" },
  electeur: { un: "vote", des: "votes" },
  "titre-saison": { un: "titre", des: "titres" },
};

export function nombre(n: number): string {
  return n.toLocaleString("fr-FR");
}

/// « 4 buts », « 1 but » — une quantité de la famille.
export function quantite(badgeId: string, n: number): string {
  const u = UNITES[badgeId];
  if (!u) return nombre(n);
  return `${nombre(n)} ${Math.abs(n) > 1 ? u.des : u.un}`;
}

/// Ce qui sépare le joueur du prochain palier : « encore 4 buts », ou pour un
/// record « record 3, palier à 5 ». `null` quand tout est pris.
export function resteAvantPalier(b: Pick<BadgeAffiche, "id" | "valeur" | "prochain">): string | null {
  if (b.prochain == null) return null;
  const u = UNITES[b.id];
  if (u?.record) {
    return b.valeur > 0
      ? `record ${nombre(b.valeur)}, palier à ${nombre(b.prochain)}`
      : `palier à ${quantite(b.id, b.prochain)}`;
  }
  const reste = Math.max(1, b.prochain - b.valeur);
  return `encore ${quantite(b.id, reste)}`;
}

const fmt = (o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { ...o, timeZone: FUSEAU });

/// « 7 sept. », avec l'année si ce n'est pas celle de `maintenant`.
export function dateCourte(iso: string, maintenant = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const memeAnnee = cleJour(d).slice(0, 4) === cleJour(maintenant).slice(0, 4);
  return fmt(memeAnnee ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" }).format(d);
}

/// « aujourd'hui », « hier », « lundi » (dans la semaine), sinon « 7 sept. ».
///
/// Le rythme du club est la semaine : « débloqué lundi » se lit mieux que
/// « il y a 3 jours », et c'est ce qu'on dit au bord du terrain. Les jours se
/// comptent dans le fuseau du club (lib/jour.ts), pas en tranches de 24 h —
/// un exploit de 23 h reste « hier » à 8 h le lendemain.
export function dateRelative(iso: string, maintenant = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const jours = Math.round(
    (Date.parse(`${cleJour(maintenant)}T00:00:00Z`) - Date.parse(`${cleJour(d)}T00:00:00Z`)) / 86_400_000,
  );
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return "hier";
  if (jours < 7) return fmt({ weekday: "long" }).format(d);
  return dateCourte(iso, maintenant);
}
