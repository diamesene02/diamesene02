// Ce que l'accueil décide avant de dessiner : quels onglets existent, lequel
// s'ouvre, ce que disent la bannière et les rappels, quelle série et quel
// palier méritent d'être montrés. Sans une ligne de React Native : ces règles
// se testent sous Node, et ce sont elles qui se trompaient (« Dans 3 jours »
// un samedi pour lundi, « Ce soir » vide un samedi).
//
// Les règles sont celles de l'accueil du site (app/c/[slug]/page.tsx et
// _accueil/ma-saison.ts), recopiées : l'app ne peut pas importer le site.
//
// Les dates arrivent déjà écrites par le serveur, dans le fuseau du club
// (`heure`, `jourAbrege`, `jourLong`…). Les fonctions `…De` ne servent qu'à un
// serveur plus ancien que le 19 septembre 2026 qui ne les rend pas, et aux
// champs qu'il n'écrit pas : elles écrivent les noms en toutes lettres, sans
// `Intl`, comme lib/datesRelatives.ts — Hermes ne formate pas le français
// partout.

import type { Accueil, MatchAccueil } from "../../lib/api";
import type { Badge, Serie } from "../../lib/succes";
import { NOMS_MATIERES, type IconeSucces, type Matiere } from "../../lib/succes-icones";
import { joursEntre, majuscule, nomDuJour } from "../../lib/datesRelatives";
import { RETRO_APRES_MS } from "../../lib/noyau/retro";
import { quantite, resteAvantPalier } from "../succes/textes";

export type Onglet = "derniere" | "soir" | "venir";

type Soiree = NonNullable<Accueil["soiree"]>;
export type Programme = NonNullable<Accueil["aVenir"]>["matchs"][number];
export type EnDirect = NonNullable<Accueil["enDirect"]>;
type LigneTableau = Accueil["classement"][number];

const JOURS_COURTS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const MOIS_COURTS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

/// « 19:00 »
export function heureDe(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/// « Lun. 21 sept. »
export function jourAbregeDe(iso: string): string {
  const d = new Date(iso);
  return majuscule(`${JOURS_COURTS[d.getDay()]} ${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`);
}

/// « Lundi 21 septembre »
export function jourLongDe(iso: string): string {
  const d = new Date(iso);
  return majuscule(`${nomDuJour(d)} ${d.getDate()} ${MOIS[d.getMonth()]}`);
}

/// « Mardi 15 » : l'onglet de la dernière soirée.
export function jourEtNumeroDe(iso: string): string {
  const d = new Date(iso);
  return majuscule(`${nomDuJour(d)} ${d.getDate()}`);
}

/// « 15 sept. » : « Soirée du 15 sept. ».
export function jourCourtDe(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`;
}

/// « Ce soir », « Aujourd'hui », « Demain », « Dans 3 jours », « Hier » — ou
/// `null` quand la date dit mieux les choses (au-delà de six jours, ou avant
/// hier). `quandRelatif` du site (lib/quand.ts).
///
/// `jours` et `heure` : ceux du serveur, comptés dans le fuseau du club,
/// quand il les donne. Sinon le jour civil et l'heure du téléphone.
export function quandRelatifDe(
  iso: string,
  maintenant: Date = new Date(),
  serveur: { jours?: number; heure?: string } = {},
): string | null {
  const n = serveur.jours ?? joursEntre(iso, maintenant);
  if (n === 0) {
    const h = serveur.heure ? Number(serveur.heure.slice(0, 2)) : new Date(iso).getHours();
    return h >= 17 ? "Ce soir" : "Aujourd'hui";
  }
  if (n === 1) return "Demain";
  if (n >= 2 && n <= 6) return `Dans ${n} jours`;
  if (n === -1) return "Hier";
  return null;
}

/// Le nombre de jours civils jusqu'à la soirée — celui du serveur (fuseau du
/// club) quand il le donne.
export function joursAvantSoiree(soiree: Soiree, maintenant: Date = new Date()): number {
  return soiree.joursAvant ?? joursEntre(soiree.date, maintenant);
}

// ── La bannière ─────────────────────────────────────────────────────────────

/// Le QUAND de la bannière, et lui seul : « Ce soir 19:00 », « Demain
/// 19:00 », « Lundi 19:00 » dans la semaine, « Lun. 28 sept. 19:00 » au-delà.
/// Le samedi, « Lun. 21 sept. » obligeait à compter.
///
/// Le lieu en sortait (`— Urban Soccer Guyancourt`), et le titre passait alors
/// sur deux lignes sous le bouton de fermeture : deux informations de rang
/// différent dans une seule phrase, qui finissait par un point comme si
/// c'était une phrase. Le lieu a sa ligne à lui (`soiree.lieu`), en dessous.
export function titreBanniere(soiree: Soiree, maintenant: Date = new Date()): string {
  const n = joursAvantSoiree(soiree, maintenant);
  const heure = soiree.heure ?? heureDe(soiree.date);
  const abrege = soiree.jourAbrege ?? jourAbregeDe(soiree.date);
  const jour =
    n <= 1
      ? (quandRelatifDe(soiree.date, maintenant, { jours: n, heure }) ?? abrege)
      : n <= 6
        ? // Le premier mot de « Lundi 21 septembre » : le jour dans le fuseau
          // du club.
          (soiree.jourLong?.split(" ")[0] ?? majuscule(nomDuJour(soiree.date)))
        : abrege;
  return `${jour} ${heure}`;
}

/// Ce que la bannière dit au joueur de SA place.
///
/// Un abonné est compté présent sans avoir répondu : « Touche pour répondre »
/// sous « 8 présents » lui laissait croire qu'il n'en faisait pas partie. Sans
/// profil joueur dans ce club (un dirigeant), il n'a rien à répondre.
///
/// Sans point final : c'est une étiquette dans une ligne de trois, pas une
/// phrase.
export function maPlace(soiree: Soiree): string {
  const p = soiree.maPresence;
  if (p === null) return "Touche pour la soirée";
  // Serveur ancien : seule la réponse explicite est connue.
  const statut = p ? p.statut : soiree.maReponse;
  if (!statut) return "Touche pour répondre";
  if (statut === "OUT") return "Tu as dit absent";
  if (statut === "MAYBE") return "Tu as dit peut-être";
  return p?.viaAbonnement ? "Tu es compté présent" : "Tu es inscrit";
}

/// « Dans 2 jours · 8 présents · 4 places · Touche pour répondre »
export function aideBanniere(soiree: Soiree, maintenant: Date = new Date()): string {
  const n = joursAvantSoiree(soiree, maintenant);
  return [n >= 2 && n <= 6 ? `Dans ${n} jours` : null, soiree.phrase, maPlace(soiree)]
    .filter(Boolean)
    .join(" · ");
}

// ── Les rappels ─────────────────────────────────────────────────────────────

/// Le rappel « les équipes ne sont pas faites », ou `null`.
///
/// La règle du site (`compoAFaire`) : la prochaine soirée, sans compo, à
/// cinq jours civils ou moins, pour qui peut scorer. Au-delà, c'est trop tôt :
/// le club décide ses équipes trois ou quatre jours avant.
export function rappelCompo(
  soiree: Soiree | null,
  peutScorer: boolean,
  maintenant: Date = new Date(),
): { titre: string; aide: string } | null {
  if (!soiree || soiree.compoFaite || soiree.annulee || !peutScorer) return null;
  const n = joursAvantSoiree(soiree, maintenant);
  if (n > 5) return null;
  const quand = n <= 0 ? "C'est aujourd'hui" : n === 1 ? "Demain" : `Dans ${n} jours`;
  const jour = soiree.jourLong ?? jourLongDe(soiree.date);
  return {
    titre: `${quand} — les équipes ne sont pas faites`,
    aide: `${jour}${soiree.lieu ? ` · ${soiree.lieu}` : ""} — préparer la compo maintenant`,
  };
}

// ── La carte des matchs ─────────────────────────────────────────────────────

export type VueMatchs = {
  derniere: NonNullable<Accueil["derniere"]> | null;
  /// La soirée du jour, pour « Soirée du 21 sept. › » en tête de « Ce soir ».
  soireeCeSoir: Soiree | null;
  /// Les matchs joués ou en cours ce soir, du premier au dernier.
  joues: MatchAccueil[];
  programmesCeSoir: Programme[];
  suivante: NonNullable<Accueil["aVenir"]>["soiree"];
  /// La prochaine soirée quand le serveur ne la détaille pas (`aVenir`
  /// absent) : juste de quoi écrire sa ligne d'en-tête, sans inventer ni
  /// noms d'équipes ni compte de réponses.
  soireeSansDetail: Soiree | null;
  programmesPlusTard: Programme[];
  onglets: { valeur: Onglet; libelle: string }[];
  /// L'onglet ouvert d'office. `null` : aucun onglet, la carte le dit.
  initial: Onglet | null;
};

/// « Lancer un match » / « Coup d'envoi » a-t-il sa place sur l'accueil ?
///
/// Pas de second coup d'envoi tant qu'un match de ce soir tourne, ici ou
/// ailleurs. Une feuille oubliée un autre jour ne le bloque pas : elle a sa
/// carte, et la soirée doit pouvoir commencer. Le serveur fait déjà cette
/// distinction (`enDirect.retro`) ; le miroir local ne la faisait pas —
/// `getLiveMatchOfClub` rend n'importe quelle feuille LIVE du club, sans
/// regarder sa date — et une feuille de la semaine dernière restée ouverte
/// effaçait le bloc de lancement le lundi soir.
export function lancementPossible(
  enDirect: { retro: boolean } | null,
  enCoursLocal: { playedAt: string } | null,
  maintenant: Date = new Date(),
): boolean {
  if (enDirect && !enDirect.retro) return false;
  if (!enCoursLocal) return true;
  // Écrit à l'endroit plutôt qu'avec un `!(… <= …)` : une date illisible
  // donne NaN, et NaN doit bloquer le lancement comme un match en cours.
  return maintenant.getTime() - Date.parse(enCoursLocal.playedAt) > RETRO_APRES_MS;
}

/// Ce que montre la carte des matchs. Un onglet n'existe que s'il a quelque
/// chose à montrer, comme sur le site.
///
/// « Ce soir » existe s'il se passe quelque chose AUJOURD'HUI : la soirée du
/// jour, un match joué ou programmé aujourd'hui, ou un match en direct. Pas
/// une feuille restée ouverte depuis mercredi (`enDirect.retro`) : elle
/// ouvrait un « Ce soir » vide le samedi, et elle a sa propre carte.
export function vueMatchs(a: Accueil, maintenant: Date = new Date()): VueMatchs {
  const soiree = a.soiree && !a.soiree.annulee ? a.soiree : null;
  const soireeCeSoir =
    soiree && (soiree.ceSoir ?? joursEntre(soiree.date, maintenant) === 0) ? soiree : null;

  const direct = a.enDirect && !a.enDirect.retro ? a.enDirect : null;
  // Une feuille ouverte depuis plus de six heures n'est plus « en direct » :
  // c'est une feuille oubliée (lib/noyau/retro), et elle a sa propre carte.
  // Rattachée à la soirée du jour, elle revenait ici en « En direct » avec un
  // chrono de quatorze heures.
  const joues = a.matchs.filter(
    (m) => m.statut !== "LIVE" || maintenant.getTime() - Date.parse(m.joueLe) <= RETRO_APRES_MS,
  );
  // Lancé à 23 h 30, il est encore en direct à minuit passé : la route ne le
  // compte plus « du jour », mais il reste dans « Ce soir ».
  if (direct && !joues.some((m) => m.id === direct.id)) {
    joues.push({
      id: direct.id,
      joueLe: direct.joueLe,
      statut: "LIVE",
      nomA: direct.nomA,
      nomB: direct.nomB,
      scoreA: direct.scoreA,
      scoreB: direct.scoreB,
      dureeMin: null,
    });
  }
  // Du premier match au dernier, comme le site : la route les rend du plus
  // récent au plus ancien.
  joues.sort((x, y) => Date.parse(x.joueLe) - Date.parse(y.joueLe));

  const programmes = a.aVenir?.matchs ?? [];
  const programmesCeSoir = programmes.filter(
    (m) => m.ceSoir ?? joursEntre(m.quand, maintenant) === 0,
  );
  const programmesPlusTard = programmes.filter((m) => !programmesCeSoir.includes(m));
  const suivante = a.aVenir?.soiree ?? null;
  const derniere = a.derniere && a.derniere.matchs.length > 0 ? a.derniere : null;
  // Un serveur plus ancien que le 19 septembre 2026 ne rend pas `aVenir` :
  // sans ce rattrapage, la carte annonçait « aucune soirée au calendrier »
  // un samedi, juste sous une bannière qui disait « Lundi 19:00 ». Le
  // serveur d'aujourd'hui rend les deux, et `suivante` passe devant.
  const soireeSansDetail = a.aVenir === undefined && soiree && !soireeCeSoir ? soiree : null;

  const ceSoirExiste =
    soireeCeSoir != null || direct != null || joues.length > 0 || programmesCeSoir.length > 0;
  const aVenirExiste =
    suivante != null || soireeSansDetail != null || programmesPlusTard.length > 0;

  const onglets: { valeur: Onglet; libelle: string }[] = [];
  if (derniere) {
    onglets.push({ valeur: "derniere", libelle: derniere.onglet ?? jourEtNumeroDe(derniere.date) });
  }
  if (ceSoirExiste) onglets.push({ valeur: "soir", libelle: "Ce soir" });
  if (aVenirExiste) onglets.push({ valeur: "venir", libelle: "À venir" });

  const initial: Onglet | null = ceSoirExiste
    ? "soir"
    : aVenirExiste
      ? "venir"
      : (onglets[0]?.valeur ?? null);

  return {
    derniere,
    soireeCeSoir,
    joues,
    programmesCeSoir,
    suivante,
    soireeSansDetail,
    programmesPlusTard,
    onglets,
    initial,
  };
}

/// L'onglet à afficher : celui qu'on a touché s'il existe encore (un
/// rechargement peut le faire disparaître), sinon l'onglet d'office.
export function ongletAffiche(vue: VueMatchs, choisi: Onglet | null): Onglet | null {
  if (choisi && vue.onglets.some((o) => o.valeur === choisi)) return choisi;
  return vue.initial;
}

const presents = (n: number) => `${n} présent${n > 1 ? "s" : ""}`;

/// « 5 contre 5 », ou « équipes à préparer ».
///
/// Sans les noms des chasubles, comme le site : « Blanc 5 contre 5 Noir » se
/// faisait couper à côté du bouton de présence, et les deux noms sont déjà
/// écrits sous les écussons, deux lignes plus haut.
export function equipes(e: { compoA: number; compoB: number }): string {
  return e.compoA + e.compoB > 0 ? `${e.compoA} contre ${e.compoB}` : "équipes à préparer";
}

/// « 8 présents · 5 contre 5 », sous la prochaine soirée.
///
/// Des PRÉSENTS, comme la bannière : les abonnés sont présents sans avoir
/// répondu, et « 0 réponse » sous un bandeau « 8 présents » se contredisait.
/// La route ne les compte que pour la soirée de la bannière : pour une autre,
/// on retombe sur les réponses.
export function ligneReponses(
  suivante: NonNullable<VueMatchs["suivante"]>,
  soiree: Soiree | null,
): string {
  const compte =
    soiree && soiree.id === suivante.id
      ? presents(soiree.presents)
      : `${suivante.reponses} réponse${suivante.reponses > 1 ? "s" : ""}`;
  return `${compte} · ${equipes(suivante)}`;
}

/// La ligne sous la soirée du jour, dans « Ce soir » avant le premier match.
/// La route ne rend pas la compo de cette soirée : on la lit dans le coup
/// d'envoi quand il vient d'elle, sinon on dit seulement si elle est faite.
export function ligneSoireeDuJour(
  soiree: Soiree,
  compo: { compoA: number; compoB: number } | null,
): string {
  const e = compo ? equipes(compo) : soiree.compoFaite ? "compo en cours" : "équipes à préparer";
  return `${presents(soiree.presents)} · ${e}`;
}

/// « Match externe · domicile · 3 présents », « Match programmé · 1 présent »
export function ligneProgramme(m: Programme): string {
  const genre = m.externe
    ? `Match externe${m.domicile == null ? "" : m.domicile ? " · domicile" : " · extérieur"}`
    : "Match programmé";
  return `${genre} · ${presents(m.presents)}`;
}

// ── Le tableau ──────────────────────────────────────────────────────────────

/// « 1er », « 3e »
export function rangTexte(rang: number): string {
  return rang === 1 ? "1er" : `${rang}e`;
}

/// Les places gagnées ou perdues depuis la dernière soirée : « ▲2 », « ▼1 ».
/// Le tableau tait le 0 pour rester léger ; « Ma saison » le dit (« = »,
/// `zero`). `null` sans point de comparaison (première soirée, nouveau venu).
export function evolutionTexte(n: number | null | undefined, zero = false): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (n === 0) return zero ? "=" : null;
  return n > 0 ? `▲${n}` : `▼${-n}`;
}

/// Pour un lecteur d'écran : « 2 places gagnées depuis la dernière soirée ».
export function evolutionPhrase(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (n === 0) return "même place qu'avant la dernière soirée";
  const k = Math.abs(n);
  return `${k} place${k > 1 ? "s" : ""} ${n > 0 ? "gagnée" : "perdue"}${k > 1 ? "s" : ""} depuis la dernière soirée`;
}

// ── Ma saison ───────────────────────────────────────────────────────────────

const pts = (n: number) => `${n} pt${n > 1 ? "s" : ""}`;

/// Qui est juste devant — ou, en tête, qui est juste derrière. Le rang vient
/// du tableau de l'accueil (même tri, même saison) : la carte et le tableau
/// juste en dessous ne peuvent pas se contredire.
export function poursuite(
  classement: readonly LigneTableau[],
  index: number,
): { titre: string; sous: string; devant: LigneTableau | null } | null {
  const moi = classement[index];
  if (!moi) return null;
  if (index === 0) {
    const derriere = classement[1];
    const avance = derriere ? moi.points - derriere.points : 0;
    return {
      titre: "Tu mènes le tableau",
      sous: derriere
        ? avance > 0
          ? `${pts(avance)} d'avance sur ${derriere.nom}`
          : `à égalité de points avec ${derriere.nom}`
        : pts(moi.points),
      devant: null,
    };
  }
  const devant = classement[index - 1];
  const ecart = devant.points - moi.points;
  // À égalité de points, le tableau départage aux victoires, puis aux buts,
  // puis au nom : on dit lequel a joué, plutôt qu'une règle générale qui
  // serait fausse une fois sur trois.
  const departage =
    devant.victoires !== moi.victoires
      ? "devant aux victoires"
      : devant.buts !== moi.buts
        ? "devant aux buts"
        : "départagés par le nom";
  // Le rang est celui de CELUI QUI EST DEVANT — l'avatar et le nom de la
  // ligne — donc `index`, qui compte depuis zéro. « 2e » tout seul se lisait
  // comme la place du joueur, affichée en grand juste au-dessus.
  const rang = rangTexte(index);
  return {
    titre: ecart > 0 ? `À ${pts(ecart)} de ${devant.nom}` : `À égalité avec ${devant.nom}`,
    sous: ecart > 0 ? `${rang} du tableau` : `${rang} du tableau · ${departage}`,
    devant,
  };
}

type RegleSerie = {
  icone: IconeSucces;
  /// En dessous, ce n'est pas une série : deux présences d'affilée, c'est
  /// l'ordinaire d'un habitué.
  min: number;
  /// Le premier palier de la famille : la série se mesure à lui, pour que
  /// « 4 sans défaite » ne passe pas devant « 3 victoires d'affilée ».
  repere: number;
  dire: (n: number) => string;
};

const SERIES: Record<Serie["id"], RegleSerie> = {
  victoires: { icone: "eclair", min: 2, repere: 3, dire: (n) => `${n} victoires d'affilée` },
  buteur: { icone: "serie", min: 2, repere: 3, dire: (n) => `${n} soirées d'affilée avec un but` },
  invincible: { icone: "bouclier", min: 3, repere: 5, dire: (n) => `${n} matchs sans défaite` },
  lundis: {
    icone: "calendrier",
    min: 3,
    repere: 3,
    dire: (n) => `${n} soirées d'affilée sans en manquer`,
  },
};

/// À poids égal, la victoire se raconte mieux que la présence.
const ORDRE_SERIES: Serie["id"][] = ["victoires", "buteur", "invincible", "lundis"];

/// La série en cours la plus parlante, ou `null` (`seriePhare` du site).
export function seriePhare(
  series: readonly Serie[],
): { id: Serie["id"]; icone: IconeSucces; titre: string; sous: string } | null {
  const par = new Map(series.map((s) => [s.id, s]));
  let choix: Serie | null = null;
  let meilleur = 0;
  for (const id of ORDRE_SERIES) {
    const s = par.get(id);
    if (!s) continue;
    const r = SERIES[id];
    if (s.enCours < r.min) continue;
    // Tant qu'il n'y a pas eu de nul, « sans défaite » répète les victoires
    // d'affilée avec le même chiffre : une ligne suffit.
    if (id === "invincible" && s.enCours <= (par.get("victoires")?.enCours ?? 0)) continue;
    const poids = s.enCours / r.repere;
    if (poids > meilleur) {
      meilleur = poids;
      choix = s;
    }
  }
  if (!choix) return null;
  const r = SERIES[choix.id];
  return {
    id: choix.id,
    icone: r.icone,
    titre: r.dire(choix.enCours),
    sous: choix.enCours >= choix.record ? "c'est ton record" : `record ${choix.record}`,
  };
}

const MATIERES: Matiere[] = ["bronze", "argent", "or", "platine", "legende"];

/// La matière d'un palier par son rang (1 = bronze) ; une famille à palier
/// unique est en or (contrat des succès).
export function matiereDuPalier(rang: number, nombreDePaliers: number): Matiere {
  if (nombreDePaliers === 1) return "or";
  return MATIERES[Math.max(1, Math.min(rang, MATIERES.length)) - 1];
}

/// Les familles qui retiennent une SÉRIE : leur prochain palier se gagne avec
/// la série en cours, pas avec le record — celui qui vient de la perdre
/// repart de zéro, et « encore 1 » lui mentirait.
const SERIE_DE_FAMILLE: Partial<Record<string, Serie["id"]>> = {
  "serie-victoires": "victoires",
  invincible: "invincible",
  "buteur-en-serie": "buteur",
  "lundis-d-affilee": "lundis",
};

/// La cote de départ de l'Élo : la barre d'un palier de cote part d'elle,
/// sinon un nouveau venu serait déjà à 91 % d'une cote de 1100.
const ELO_DEPART = 1000;

/// « Buteur argent », « encore 2 buts », et la part du chemin faite
/// (`prochainPalier` du site).
export function prochainPalier(
  b: Pick<Badge, "id" | "nom" | "paliers" | "palier" | "valeur" | "prochain">,
  series: readonly Serie[],
): { titre: string; sous: string; part: number } | null {
  if (b.prochain == null) return null;
  const titre =
    b.paliers.length > 1
      ? `${b.nom} ${NOMS_MATIERES[matiereDuPalier(b.palier + 1, b.paliers.length)].toLowerCase()}`
      : b.nom;
  const idSerie = SERIE_DE_FAMILLE[b.id];
  const enCours = idSerie ? series.find((s) => s.id === idSerie)?.enCours : undefined;
  if (enCours !== undefined) {
    return {
      titre,
      sous: `encore ${quantite(b.id, Math.max(1, b.prochain - enCours))}`,
      part: enCours / b.prochain,
    };
  }
  const sous = resteAvantPalier(b) ?? "";
  if (b.id === "elo") {
    return { titre, sous, part: Math.max(0, b.valeur - ELO_DEPART) / (b.prochain - ELO_DEPART) };
  }
  return { titre, sous, part: b.valeur / b.prochain };
}

// ── Les exploits du club ────────────────────────────────────────────────────

/// « Bakary et Cédric », « Bakary, Cédric et Diame », « Bakary, Cédric et
/// 4 autres ».
export function lesNoms(noms: readonly string[]): string {
  if (noms.length <= 1) return noms[0] ?? "";
  if (noms.length <= 3) return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
  const reste = noms.length - 2;
  return `${noms[0]}, ${noms[1]} et ${reste} autre${reste > 1 ? "s" : ""}`;
}

/// Le fil regroupé : un même palier franchi le même jour par plusieurs
/// joueurs tient sur UNE ligne. Le soir où les habitués font leur dixième
/// soirée, le fil brut alignait cinq fois « Toujours là » et ne montrait rien
/// d'autre. Cinq lignes au plus. Le jour est celui du téléphone.
export function grouperFil<E extends { badgeId: string; palier: number; le: string }>(
  fil: readonly E[],
  lignes = 5,
): E[][] {
  const groupes = new Map<string, E[]>();
  for (const e of fil) {
    const cle = `${e.badgeId}:${e.palier}:${new Date(e.le).toDateString()}`;
    const g = groupes.get(cle);
    if (g) g.push(e);
    else if (groupes.size < lignes) groupes.set(cle, [e]);
  }
  return [...groupes.values()];
}
