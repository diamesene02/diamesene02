import "server-only";

// Le fuseau et la borne du jour vivent dans `lib/jour.ts` depuis le
// 18 septembre 2026 (spec 0007) : ce fichier-ci porte `server-only`, qui lève
// hors React Server, et la règle « un match rejoint la soirée du même jour »
// devait être testable (article VIII). On les ré-exporte pour que les appels
// existants ne bougent pas.
export { FUSEAU, minuit, debutDuJour, memeJour, cleJour } from "./jour";
import { FUSEAU } from "./jour";

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: FUSEAU });

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/// « 20:00 »
export const heure = (d: Date) =>
  fmt({ hour: "2-digit", minute: "2-digit" }).format(d);

/// « 7 sept. »
export const jourCourt = (d: Date) =>
  fmt({ day: "numeric", month: "short" }).format(d);

/// « 07 sept. »
export const jourCourt2 = (d: Date) =>
  fmt({ day: "2-digit", month: "short" }).format(d);

/// « Lundi 7 »
export const jourEtNumero = (d: Date) =>
  majuscule(fmt({ weekday: "long", day: "numeric" }).format(d));

/// « Lundi 7 septembre »
export const jourLong = (d: Date) =>
  majuscule(fmt({ weekday: "long", day: "numeric", month: "long" }).format(d));

/// « Sam. 19 sept. »
export const jourAbrege = (d: Date) =>
  majuscule(fmt({ weekday: "short", day: "numeric", month: "short" }).format(d));

/// « lun. »
export const jourSemaine = (d: Date) => fmt({ weekday: "short" }).format(d);

/// « lun. 07 »
export const jourSemaineNumero = (d: Date) =>
  fmt({ weekday: "short", day: "2-digit" }).format(d);

/// « septembre 2026 »
export const moisAnnee = (d: Date) =>
  fmt({ month: "long", year: "numeric" }).format(d);

/// « 07 sept. 2026 »
export const dateComplete = (d: Date) =>
  fmt({ day: "2-digit", month: "short", year: "numeric" }).format(d);

/// Le quantième du mois DANS LE FUSEAU — `getDate()` répond dans celui du
/// processus, ce qui décale la pastille du calendrier une soirée sur deux.
export const quantieme = (d: Date) => Number(fmt({ day: "numeric" }).format(d));

/// « lundi » — le jour de la semaine seul, en minuscules.
export const jourSemaineLong = (d: Date) =>
  fmt({ weekday: "long" }).format(d);

/// « Lundi 07 septembre »
export const jourLong2 = (d: Date) =>
  majuscule(fmt({ weekday: "long", day: "2-digit", month: "long" }).format(d));

/// « 07 septembre »
export const jourMoisLong = (d: Date) =>
  fmt({ day: "2-digit", month: "long" }).format(d);
