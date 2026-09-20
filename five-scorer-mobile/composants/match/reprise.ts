import { RETRO_APRES_MS } from "../../lib/noyau/retro";
import type { LocalMatch } from "../../lib/outbox/types";

// Reprendre une feuille déjà ouverte, ou en ouvrir une neuve : la question se
// pose aux deux endroits qui enchaînent les matchs d'une soirée (« Match
// suivant — mêmes équipes » sur la feuille terminée, « Rejouer » sur le
// récap). Elle vit ici, sans React ni Expo, parce qu'elle se teste — contre le
// vrai SQLite du noyau, dans `reprise.test.ts`.

/// Le match qu'on s'apprête à créer, réduit à ce qui l'identifie.
type Attendu = {
  /// La soirée du match à créer. `null` = un match hors soirée.
  matchDayId: string | null;
  /// L'heure qu'il portera, ou `null` pour « maintenant » (le cas normal :
  /// on enchaîne en direct). En rattrapage, c'est une heure passée.
  playedAt: string | null;
};

/// La feuille en cours qu'on peut VRAIMENT reprendre au lieu d'en ouvrir une
/// seconde — ou `null` s'il faut en créer une.
///
/// **Pourquoi ce tri existe.** Le garde d'origine était `getLiveMatchOfClub()`
/// nu : s'il y avait un match LIVE sur le téléphone, on y allait. Or cette
/// requête ne filtre ni la date ni la soirée (`lireMatchEnCours`, un
/// `WHERE club_id = ? AND status = 'LIVE'`), et un téléphone garde parfois une
/// feuille d'un autre lundi restée ouverte — l'accueil a une carte
/// « Terminer cette feuille ? » pour exactement ça. Le soir où le match 1 se
/// terminait, il redevenait la SEULE ligne LIVE du club : « Match suivant —
/// mêmes équipes » y emmenait sans un mot, avec d'autres équipes et un score
/// qui n'était pas 0-0, et chaque but tapé ensuite s'écrivait — et partait au
/// serveur — dans le match de la semaine dernière.
///
/// Le garde ne sert qu'à un cas : le double tap, ou le retour en arrière, sur
/// le bouton qu'on vient d'utiliser. Il doit donc reconnaître la feuille qu'on
/// AURAIT créée, et rien d'autre. Trois conditions :
///
///   1. **la même soirée** — un match d'un autre lundi n'est pas celui-ci ;
///   2. **le même jour** — le filet quand les deux sont hors soirée
///      (`matchDayId` à `null` des deux côtés ne prouve rien) ;
///   3. **ouverte depuis moins de six heures**, sauf en rattrapage où toutes
///      les feuilles sont anciennes par construction : une feuille du matin
///      oubliée n'est pas « celle de ce soir ».
///
/// En cas de doute on crée : une feuille en trop se termine d'un geste, des
/// buts écrits dans le match de la semaine dernière ne se rattrapent pas.
export function feuilleAReprendre(
  enCours: LocalMatch | undefined | null,
  attendu: Attendu,
  maintenant: number = Date.now(),
): LocalMatch | null {
  if (!enCours) return null;
  if ((enCours.matchDayId ?? null) !== attendu.matchDayId) return null;

  const quand = attendu.playedAt ? Date.parse(attendu.playedAt) : maintenant;
  const ouverte = Date.parse(enCours.playedAt);
  if (Number.isNaN(quand) || Number.isNaN(ouverte)) return null;
  if (!memeJour(ouverte, quand)) return null;

  const rattrapage = maintenant - quand > RETRO_APRES_MS;
  if (!rattrapage && maintenant - ouverte > RETRO_APRES_MS) return null;

  return enCours;
}

/// Deux instants tombent-ils le même jour, à l'heure du téléphone ? Le
/// calendrier local, pas UTC : un match du lundi 21 h en France est un
/// dimanche 19 h en UTC, et c'est bien lundi qu'il s'est joué.
function memeJour(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
