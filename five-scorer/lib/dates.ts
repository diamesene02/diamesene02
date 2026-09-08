import "server-only";

/// Le fuseau du club.
///
/// Les pages serveur formataient les dates avec `toLocaleDateString` sans
/// fuseau : elles prenaient donc celui du PROCESSUS. En développement c'est
/// la machine de celui qui code — Paris — et tout paraissait juste. En
/// production, une fonction Vercel tourne en UTC : chaque heure affichée
/// sortait deux heures trop tôt l'été, une heure l'hiver. Une soirée à 19 h
/// s'annonçait à 17 h, sur l'accueil, dans le calendrier, dans la bannière et
/// sur la page de la soirée elle-même. Le club l'a lu comme une erreur de
/// saisie ; c'était le serveur.
///
/// Une constante, et non un champ du club : l'application est en français,
/// pour des clubs qui jouent en France. Le jour où ce ne sera plus vrai, ce
/// fichier est le seul endroit à changer — chaque appel passe déjà par lui.
export const FUSEAU = "Europe/Paris";

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

/// Minuit du jour de `d`, dans le fuseau, en millisecondes epoch. Sert aux
/// comparaisons « même jour », « déjà passé ».
export function minuit(d: Date): number {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  // « 2026-09-07 » → l'instant de minuit local, obtenu en retirant le décalage
  // du jour concerné (et non celui d'aujourd'hui : l'heure d'été change).
  const minuitUTC = Date.parse(`${p}T00:00:00Z`);
  const decalage = decalageMs(new Date(minuitUTC));
  return minuitUTC - decalage;
}

/// Le décalage du fuseau à cet instant, en millisecondes.
function decalageMs(d: Date): number {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSEAU,
    timeZoneName: "longOffset",
  })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = s?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const signe = m[1] === "-" ? -1 : 1;
  return signe * (Number(m[2]) * 3600_000 + Number(m[3]) * 60_000);
}

/// Minuit du jour courant, dans le fuseau.
export const debutDuJour = () => new Date(minuit(new Date()));

/// « lundi » — le jour de la semaine seul, en minuscules.
export const jourSemaineLong = (d: Date) =>
  fmt({ weekday: "long" }).format(d);

/// « Lundi 07 septembre »
export const jourLong2 = (d: Date) =>
  majuscule(fmt({ weekday: "long", day: "2-digit", month: "long" }).format(d));

/// « 07 septembre »
export const jourMoisLong = (d: Date) =>
  fmt({ day: "2-digit", month: "long" }).format(d);
