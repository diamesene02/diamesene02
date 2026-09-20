// Les dates dites comme on les dit : « demain », « lundi », « hier ».
//
// Tout se compte en JOURS CIVILS DU TÉLÉPHONE, d'un minuit à l'autre, et
// jamais en tranches de 24 heures. L'accueil faisait
// `Math.ceil((date − maintenant) / 86 400 000)` : samedi 17 h 22 pour lundi
// 19 h, 2,07 jours, arrondis à « Dans 3 jours » ; lundi 10 h pour 19 h,
// « Dans 1 jour ». Deux fois faux, et au mauvais moment — c'est le rappel
// qu'on lit pour savoir si c'est ce soir.
//
// Le site compte de minuit à minuit (app/c/[slug]/page.tsx), et c'est ce
// qu'on fait ici. `Date.UTC` sur les composantes LOCALES rend l'écart exact
// même quand un changement d'heure tombe entre les deux dates : un jour de
// 23 heures reste un jour.
//
// Pas d'`Intl` : les noms de jours sont écrits en toutes lettres, pour ne
// pas dépendre de ce que Hermes embarque selon la plateforme.

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

type Quand = Date | string | number;

function enDate(d: Quand): Date {
  return d instanceof Date ? d : new Date(d);
}

/// Le nombre de jours civils de `maintenant` à `date` : 0 le jour même, 1
/// demain, -1 hier. Le fuseau est celui du téléphone.
export function joursEntre(date: Quand, maintenant: Quand = new Date()): number {
  const a = enDate(maintenant);
  const b = enDate(date);
  const jourA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const jourB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((jourB - jourA) / 86_400_000);
}

/// Le nom du jour, en minuscules : « lundi ».
export function nomDuJour(date: Quand): string {
  return JOURS[enDate(date).getDay()];
}

/// Le jour, dit comme on le dit au vestiaire.
///
/// « aujourd'hui », « demain », puis le nom du jour tant qu'il est dans la
/// semaine qui vient (« lundi » — pas d'ambiguïté à moins de sept jours),
/// puis « dans 9 jours ». Même chose vers le passé : « hier », « lundi
/// dernier », « il y a 9 jours ».
///
/// `ceSoir` : un rendez-vous d'aujourd'hui à partir de 17 h devient « ce
/// soir ». C'est le mot du site pour la soirée du jour.
export function jourRelatif(
  date: Quand,
  options: { maintenant?: Quand; ceSoir?: boolean } = {},
): string {
  const n = joursEntre(date, options.maintenant ?? new Date());
  if (n === 0) {
    return options.ceSoir && enDate(date).getHours() >= 17 ? "ce soir" : "aujourd'hui";
  }
  if (n === 1) return "demain";
  if (n === -1) return "hier";
  if (n > 1 && n < 7) return nomDuJour(date);
  if (n < -1 && n > -7) return `${nomDuJour(date)} dernier`;
  return n > 0 ? `dans ${n} jours` : `il y a ${-n} jours`;
}

/// Le compte à rebours, sans nom de jour : « aujourd'hui », « demain »,
/// « dans 5 jours », « hier », « il y a 5 jours ». Pour les rappels où le
/// nombre compte plus que le jour (« les équipes ne sont pas faites »).
export function compteARebours(date: Quand, maintenant: Quand = new Date()): string {
  const n = joursEntre(date, maintenant);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  if (n === -1) return "hier";
  return n > 0 ? `dans ${n} jours` : `il y a ${-n} jours`;
}

/// La majuscule du début de phrase : « Demain », « Lundi dernier ».
export function majuscule(texte: string): string {
  return texte ? texte[0].toUpperCase() + texte.slice(1) : texte;
}
