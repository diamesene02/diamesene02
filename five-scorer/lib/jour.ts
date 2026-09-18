/// Le jour du club : son fuseau, sa borne de minuit, sa fenêtre.
///
/// Ce fichier est né le 18 septembre 2026 (spec 0007) d'une contrainte
/// d'outillage, pas d'un goût d'architecture. `lib/dates.ts` porte
/// `import "server-only"` — et ce marqueur **lève** partout sauf sous la
/// condition d'export `react-server`, que ni Node ni Vite n'activent :
///
///     $ node -e "import('server-only').catch(e => console.log(e.message))"
///     This module cannot be imported from a Client Component module.
///
/// Rien de ce qui l'importe n'est donc testable, et `vitest.config.ts:15` ne
/// ramasse que `lib/**/*.test.ts`. Contre-épreuve : aucun des fichiers `lib/`
/// couverts par un test n'importait `dates.ts`. Or la règle « un match
/// rejoint la soirée du même jour » doit être vérifiable par une commande
/// (constitution, article VIII) : sa borne devait sortir de derrière le
/// marqueur.
///
/// `lib/dates.ts` ré-exporte `FUSEAU`, `minuit` et `debutDuJour` : aucun de
/// ses appelants n'a bougé.

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
/// (Et l'article IX de la constitution interdirait justement de poser ce
/// réglage sur `Club`.)
export const FUSEAU = "Europe/Paris";

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

/// « 2026-09-14 » — le jour civil de `d` dans le fuseau du club.
///
/// C'est la clé d'un jour : deux instants la partagent si et seulement s'ils
/// tombent le même jour au gymnase. Stable des deux côtés d'un changement
/// d'heure, parce qu'elle ne fait aucune arithmétique — elle demande à
/// `Intl` quel jour il était là-bas.
export function cleJour(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/// Minuit du jour de `d`, dans le fuseau, en millisecondes epoch. Sert aux
/// comparaisons « même jour », « déjà passé ».
export function minuit(d: Date): number {
  // « 2026-09-07 » → l'instant de minuit local, obtenu en retirant le décalage
  // du jour concerné (et non celui d'aujourd'hui : l'heure d'été change).
  const minuitUTC = Date.parse(`${cleJour(d)}T00:00:00Z`);
  const decalage = decalageMs(new Date(minuitUTC));
  return minuitUTC - decalage;
}

/// Minuit du jour courant, dans le fuseau.
export const debutDuJour = () => new Date(minuit(new Date()));

/// La journée qui contient `d`, en instants : `[debut, fin[`.
///
/// **L'intervalle est demi-ouvert**, et c'est ce qui rend la règle du lot
/// 0007 explicable en une phrase : un match joué à 23:30 un lundi appartient
/// au lundi, un match joué à 00:30 le mardi appartient au mardi. Pas de
/// fenêtre glissante — le produit en a déjà essayé une, et elle attirait le
/// match du mardi matin dans la soirée du lundi.
///
/// `fin` se calcule depuis le minuit du LENDEMAIN, pas par `debut + 24 h` :
/// les deux diffèrent d'une heure deux fois par an, et c'est exactement le
/// genre d'écart qui ne se voit qu'un dimanche d'octobre.
export function fenetreDuJour(d: Date): { debut: Date; fin: Date } {
  const debut = minuit(d);
  const fin = minuit(new Date(debut + 36 * 3600_000));
  return { debut: new Date(debut), fin: new Date(fin) };
}

/// Vrai si les deux instants tombent le même jour au gymnase.
export const memeJour = (a: Date, b: Date) => cleJour(a) === cleJour(b);
