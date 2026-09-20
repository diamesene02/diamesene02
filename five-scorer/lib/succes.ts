/// Les succès du joueur : paliers, séries, niveau — tout se déduit.
///
/// Aucune table, aucune colonne : chaque lecture rejoue l'historique des
/// matchs terminés (contrat du 19 septembre 2026). C'est ce qui couvre tout
/// l'historique dès le premier jour, ce qui fait suivre d'elles-mêmes les
/// corrections de feuille, et ce qui rend un retour arrière trivial — on
/// retire le code, il ne reste rien dans la base.
///
/// Ce module est PUR : ni Prisma, ni `server-only`, ni `lib/dates.ts` (qui
/// lève hors d'un composant serveur). Il reçoit un historique compact, chargé
/// par `lib/succes-serveur.ts`, et rend le club entier d'un coup : la rareté
/// d'un succès a besoin de tous les joueurs, et l'Élo se rejoue une seule
/// fois pour tout le monde.
///
/// Deux pièges gouvernent la moitié des règles ci-dessous :
///   - la soirée CUMULÉE : une soirée saisie après coup en un seul match
///     (« Blanc 18 – Noir 9 ») fabriquerait des triplés et des corrections à
///     la pelle. Les succès « par match » l'ignorent, les cumuls la comptent ;
///   - l'ORDRE des buts : l'heure d'un but vient du téléphone, une correction
///     l'ajoute en fin de chronologie, une feuille rétro n'a pas de minute.
///     Remontada, ouverture et but décisif ne se lisent que sur les matchs
///     où chaque but a sa minute et qu'aucune correction n'a touchés.

import { computeElo } from "./elo";
import { FUSEAU } from "./jour";
import { points, trierParPoints } from "./classement";

// ─── Formes rendues (contrat, recopiées telles quelles côté app) ──────────

export type Matiere = "bronze" | "argent" | "or" | "platine" | "legende";
export type IconeSucces =
  | "debut" | "ballon" | "passe" | "double" | "chapeau" | "feu" | "serie"
  | "etoile" | "victoire" | "eclair" | "bouclier" | "couronne" | "maillot"
  | "lundi" | "calendrier" | "remontada" | "decisif" | "ouvreur" | "gant"
  | "mur" | "fessee" | "elo" | "duo" | "veteran" | "vote" | "titre";

export type Badge = {
  id: string;
  nom: string;
  icone: IconeSucces;
  description: string;
  paliers: number[];
  palier: number;
  matiere: Matiere | null;
  valeur: number;
  prochain: number | null;
  obtenuLe: string | null;
  matchId: string | null;
  rarete: number | null;
};

export type Deblocage = {
  badgeId: string; nom: string; icone: IconeSucces; matiere: Matiere;
  palier: number;
  seuil: number;
  libelle: string;
  le: string;
  matchId: string | null;
};

export type Niveau = {
  niveau: number; titre: string; xp: number;
  xpNiveau: number;
  xpSuivant: number;
  progression: number;
};

export type Serie = {
  id: "victoires" | "invincible" | "buteur" | "lundis";
  nom: string; enCours: number; record: number;
};

export type SuccesJoueur = {
  joueur: { id: string; nom: string; photo?: never };
  niveau: Niveau;
  xpDetail: { source: string; xp: number }[];
  series: Serie[];
  badges: Badge[];
  deblocages: Deblocage[];
  prochain: Badge | null;
  classement: {
    rang: number | null; total: number; points: number;
    evolution: number | null;
    devant: { nom: string; points: number } | null;
  };
};

export type DeblocageJoueur = Deblocage & { playerId: string; joueur: string };

/// Une ligne de l'onglet « Raretés » : le palier le plus HAUT que le club
/// détient dans une famille, et qui le tient.
export type Rarete = {
  badgeId: string;
  nom: string;
  icone: IconeSucces;
  matiere: Matiere;
  /// Rang de ce palier (1 = bronze).
  palier: number;
  /// « 25 buts » : ce palier-là.
  libelle: string;
  detenteurs: { playerId: string; nom: string }[];
  /// Le nombre de joueurs parmi lesquels on compte (= `niveaux.length`).
  total: number;
};

export type SuccesClub = {
  niveaux: { playerId: string; nom: string; niveau: number; titre: string; xp: number }[];
  fil: DeblocageJoueur[];
  raretes: Rarete[];
  evolutions: Record<string, number>;
};

export type ResultatSucces = {
  /// Tous les joueurs du club, invités et archivés compris.
  parJoueur: Map<string, SuccesJoueur>;
  club: SuccesClub;
  /// Les paliers franchis pendant CE match, tous joueurs confondus.
  deblocagesDuMatch: (matchId: string) => DeblocageJoueur[];
};

// ─── Ce que le moteur reçoit ──────────────────────────────────────────────

export type Camp = "A" | "B";

export type MatchHistorique = {
  id: string;
  playedAt: Date;
  createdAt: Date;
  matchDayId: string | null;
  seasonId: string | null;
  kind: "INTERNAL" | "EXTERNAL";
  /// Le moteur ne garde que FINISHED : le chargeur filtre déjà, mais un
  /// match annulé qui passerait quand même ne doit rien rapporter.
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "CANCELED";
  scoreA: number;
  scoreB: number;
  mvpId: string | null;
  correctedAt: Date | null;
  participants: { playerId: string; initialTeam: Camp; isGk: boolean }[];
  events: {
    id: string;
    type: "GOAL" | "OWN_GOAL" | "YELLOW_CARD" | "RED_CARD" | "HALF_TIME";
    /// Équipe créditée : sur un CSC, c'est le bénéficiaire.
    team: Camp;
    /// Le buteur, ou l'AUTEUR du CSC.
    playerId: string | null;
    assistPlayerId: string | null;
    minute: number | null;
    createdAt: Date;
  }[];
};

export type JoueurHistorique = {
  id: string;
  name: string;
  isGuest: boolean;
  isArchived: boolean;
  userId: string | null;
};

export type SaisonHistorique = {
  id: string;
  name: string;
  isActive: boolean;
  startsAt: Date;
  endsAt: Date | null;
};

export type VoteHistorique = { voterId: string; matchId: string; createdAt: Date };

export type Historique = {
  reglages: {
    pointsWin: number;
    pointsDraw: number;
    trackAssists: boolean;
    motmMode: "VOTE" | "ADMIN" | "OFF";
  };
  matchs: MatchHistorique[];
  joueurs: JoueurHistorique[];
  saisons: SaisonHistorique[];
  /// Les soirées (MatchDay) annulées : « Toujours là » les saute.
  soireesAnnulees: string[];
  votes: VoteHistorique[];
};

// ─── Catalogue ────────────────────────────────────────────────────────────

export type IdFamille =
  | "premiers-pas" | "buteur" | "passeur" | "double" | "triple"
  | "soiree-de-buteur" | "buteur-en-serie" | "homme-du-match" | "victoires"
  | "serie-victoires" | "invincible" | "roi-du-lundi" | "centurion"
  | "habitue" | "lundis-d-affilee" | "remontada" | "but-de-la-victoire"
  | "ouvreur" | "muraille" | "clean-sheet" | "victoire-large" | "elo"
  | "duo" | "veteran" | "electeur" | "titre-saison";

export type Famille = {
  id: IdFamille;
  nom: string;
  icone: IconeSucces;
  paliers: number[];
  /// Le palier en deux mots, pour une annonce : « 10 buts ».
  libelle: (seuil: number) => string;
  /// Une phrase courte, pour la vitrine : « 10 buts en carrière ».
  description: (seuil: number) => string;
};

const premier = (n: number, seul: string, plusieurs: string) =>
  n === 1 ? seul : plusieurs;

/// L'ordre du catalogue est celui de la vitrine, et il départage les
/// égalités partout ailleurs (annonces du même match, famille la plus
/// proche) : un ordre fixe, sinon deux rafraîchissements se contrediraient.
export const FAMILLES: readonly Famille[] = [
  {
    id: "premiers-pas", nom: "Premiers pas", icone: "debut", paliers: [1],
    libelle: () => "Premier match",
    description: () => "Un premier match sous ces couleurs",
  },
  {
    id: "buteur", nom: "Buteur", icone: "ballon",
    paliers: [1, 5, 10, 25, 50, 100, 200, 300],
    libelle: (n) => premier(n, "Premier but", `${n} buts`),
    description: (n) => premier(n, "Un premier but", `${n} buts en carrière`),
  },
  {
    id: "passeur", nom: "Passeur", icone: "passe",
    paliers: [1, 5, 10, 25, 50, 100],
    libelle: (n) => premier(n, "Première passe décisive", `${n} passes décisives`),
    description: (n) =>
      premier(n, "Une première passe décisive", `${n} passes décisives en carrière`),
  },
  {
    id: "double", nom: "Doublé", icone: "double", paliers: [1, 10, 25],
    libelle: (n) => premier(n, "Premier doublé", `${n} doublés`),
    description: (n) =>
      premier(n, "Deux buts dans un même match", `${n} matchs à deux buts ou plus`),
  },
  {
    id: "triple", nom: "Coup du chapeau", icone: "chapeau", paliers: [1, 5, 10],
    libelle: (n) => premier(n, "Premier coup du chapeau", `${n} coups du chapeau`),
    description: (n) =>
      premier(n, "Trois buts dans un même match", `${n} matchs à trois buts ou plus`),
  },
  {
    id: "soiree-de-buteur", nom: "Soirée de feu", icone: "feu", paliers: [3, 5, 8, 12],
    libelle: (n) => `${n} buts en une soirée`,
    description: (n) => `${n} buts sur une même soirée`,
  },
  {
    id: "buteur-en-serie", nom: "Buteur en série", icone: "serie", paliers: [3, 5, 10],
    libelle: (n) => `${n} soirées de suite avec un but`,
    description: (n) => `Marquer à chacune de ${n} soirées jouées d'affilée`,
  },
  {
    id: "homme-du-match", nom: "Homme du match", icone: "etoile",
    paliers: [1, 3, 5, 10, 25, 50],
    libelle: (n) => premier(n, "Premier titre d'homme du match", `${n} fois homme du match`),
    description: (n) => premier(n, "Élu homme du match", `Élu homme du match ${n} fois`),
  },
  {
    id: "victoires", nom: "Gagnant", icone: "victoire",
    paliers: [1, 10, 25, 50, 100, 250],
    libelle: (n) => premier(n, "Première victoire", `${n} victoires`),
    description: (n) => premier(n, "Une première victoire", `${n} victoires en carrière`),
  },
  {
    id: "serie-victoires", nom: "Série de victoires", icone: "eclair", paliers: [3, 5, 10, 15],
    libelle: (n) => `${n} victoires d'affilée`,
    description: (n) => `Gagner ${n} matchs d'affilée`,
  },
  {
    id: "invincible", nom: "Invincible", icone: "bouclier", paliers: [5, 10, 20, 30],
    libelle: (n) => `${n} matchs sans défaite`,
    description: (n) => `${n} matchs d'affilée sans perdre`,
  },
  {
    id: "roi-du-lundi", nom: "Roi du lundi", icone: "couronne", paliers: [5, 10, 25, 50],
    libelle: (n) => `${n} soirées gagnées`,
    description: (n) => `Dans le camp qui gagne la soirée, ${n} fois`,
  },
  {
    id: "centurion", nom: "Centurion", icone: "maillot",
    paliers: [10, 25, 50, 100, 200, 500],
    libelle: (n) => `${n} matchs`,
    description: (n) => `${n} matchs joués`,
  },
  {
    id: "habitue", nom: "Habitué", icone: "lundi", paliers: [10, 25, 50, 100],
    libelle: (n) => `${n} soirées`,
    description: (n) => `${n} soirées jouées`,
  },
  {
    id: "lundis-d-affilee", nom: "Toujours là", icone: "calendrier", paliers: [3, 5, 10, 20],
    libelle: (n) => `${n} soirées d'affilée`,
    description: (n) => `Présent à ${n} soirées de suite, sans en manquer une`,
  },
  {
    id: "remontada", nom: "Remontada", icone: "remontada", paliers: [1, 5],
    libelle: (n) => premier(n, "Première remontada", `${n} remontadas`),
    description: (n) =>
      premier(
        n,
        "Gagner après avoir été mené de deux buts",
        `${n} victoires après avoir été mené de deux buts`,
      ),
  },
  {
    id: "but-de-la-victoire", nom: "But décisif", icone: "decisif", paliers: [1, 5, 10, 25],
    libelle: (n) => premier(n, "Premier but décisif", `${n} buts décisifs`),
    description: (n) =>
      premier(
        n,
        "Le but qui donne l'avance pour de bon",
        `${n} buts qui donnent l'avance pour de bon`,
      ),
  },
  {
    id: "ouvreur", nom: "Ouvreur", icone: "ouvreur", paliers: [1, 10, 25],
    libelle: (n) => premier(n, "Premier but d'ouverture", `${n} ouvertures du score`),
    description: (n) => premier(n, "Ouvrir le score d'un match", `Ouvrir le score ${n} fois`),
  },
  {
    id: "muraille", nom: "Muraille", icone: "gant", paliers: [1, 10, 25, 50],
    libelle: (n) => premier(n, "Premier match aux cages", `${n} matchs aux cages`),
    description: (n) => premier(n, "Garder les cages d'un match", `Garder les cages ${n} matchs`),
  },
  {
    id: "clean-sheet", nom: "Cage inviolée", icone: "mur", paliers: [1, 5, 10],
    libelle: (n) => premier(n, "Première cage inviolée", `${n} cages inviolées`),
    description: (n) =>
      premier(n, "Garder les cages sans encaisser", `${n} matchs aux cages sans encaisser`),
  },
  {
    id: "victoire-large", nom: "Correction", icone: "fessee", paliers: [1, 10],
    libelle: (n) => premier(n, "Première correction", `${n} corrections`),
    description: (n) =>
      premier(n, "Gagner de cinq buts ou plus", `${n} victoires par cinq buts d'écart ou plus`),
  },
  {
    id: "elo", nom: "Cote", icone: "elo", paliers: [1100, 1200, 1300],
    libelle: (n) => `Cote de ${n}`,
    description: (n) => `Atteindre ${n} à l'Élo`,
  },
  {
    id: "duo", nom: "Duo de feu", icone: "duo", paliers: [5, 10, 25],
    libelle: (n) => `${n} buts du même duo`,
    description: (n) => `${n} buts entre le même passeur et le même buteur`,
  },
  {
    id: "veteran", nom: "Vétéran", icone: "veteran", paliers: [2, 3, 5],
    libelle: (n) => `${n} saisons`,
    description: (n) => `Joué sur ${n} saisons`,
  },
  {
    id: "electeur", nom: "Électeur", icone: "vote", paliers: [10, 25, 50],
    libelle: (n) => `${n} votes`,
    description: (n) => `${n} votes pour l'homme du match`,
  },
  {
    id: "titre-saison", nom: "Palmarès", icone: "titre", paliers: [1, 3, 5],
    libelle: (n) => premier(n, "Premier titre de saison", `${n} titres de saison`),
    description: (n) =>
      premier(
        n,
        "Meilleur buteur, passeur ou homme du match d'une saison",
        `${n} titres de fin de saison`,
      ),
  },
];

// ─── Règles chiffrées ─────────────────────────────────────────────────────

/// Une soirée cumulée : seul match de sa soirée, et au moins ce total de buts.
export const SEUIL_CUMULEE = 12;
/// Écart d'une « Correction ».
const ECART_CORRECTION = 5;
/// Retard remonté pour une « Remontada ».
const RETARD_REMONTADA = 2;
/// Un vote ne compte pour « Électeur » que s'il tombe dans les 72 heures qui
/// entourent la soirée — ou sa SAISIE, si elle est venue après (voir
/// `votes`). Le vote n'a pas de clôture (app/actions/motm.ts) : sans fenêtre,
/// on débloquerait le succès en votant d'un coup sur cinquante vieux matchs.
const FENETRE_VOTE_MS = 72 * 3600_000;
/// Le fil du club : 30 jours, 20 ÉVÉNEMENTS (un palier, un jour), et un
/// plafond de lignes pour que la réponse reste petite.
const FIL_JOURS = 30;
const FIL_MAX = 20;
const FIL_LIGNES_MAX = 120;
/// Ce qui est daté d'après-demain n'a pas eu lieu : rien ne borne `playedAt`
/// à l'écriture (app/actions/matches.ts, route des matchs), et une date mal
/// tapée — 2028 pour 2026 — tiendrait le haut du fil et ferait passer son
/// soir pour « la dernière soirée » jusqu'à ce que quelqu'un la corrige. Une
/// journée de marge : une feuille programmée à 20 h 30 et terminée à 20 h 15
/// est du présent.
const MARGE_FUTUR_MS = 24 * 3600_000;
/// Les raretés du club : cinq lignes, et ce que plus de la moitié du club
/// détient n'est pas rare.
const RARETES_MAX = 5;
const ELO_BASE = 1000;

const MATIERES: Matiere[] = ["bronze", "argent", "or", "platine", "legende"];

/// La matière d'un palier, à partir de son rang (1 = le premier). Une
/// famille à palier unique est en or : c'est le seul qu'elle a.
export function matiereDuPalier(rang: number, nombreDePaliers: number): Matiere {
  if (nombreDePaliers === 1) return "or";
  return MATIERES[Math.min(rang, MATIERES.length) - 1];
}

const BONUS_MATIERE: Record<Matiere, number> = {
  bronze: 25,
  argent: 50,
  or: 100,
  platine: 200,
  legende: 400,
};

/// XP qu'il faut pour atteindre le niveau n : 0, 100, 300, 600, 1000…
export function seuilNiveau(n: number): number {
  return 50 * n * (n - 1);
}

export function titreNiveau(n: number): string {
  if (n >= 20) return "Légende";
  if (n >= 15) return "Pilier";
  if (n >= 10) return "Taulier";
  if (n >= 6) return "Cadre";
  if (n >= 3) return "Titulaire";
  return "Recrue";
}

const arrondi = (x: number) => Math.round(x * 1000) / 1000;

export function niveauPourXp(xp: number): Niveau {
  // Le calcul direct, puis deux boucles de garde contre l'arrondi flottant
  // de la racine : un seuil exact (100, 300…) doit donner le niveau plein.
  let n = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2));
  while (seuilNiveau(n + 1) <= xp) n++;
  while (n > 1 && seuilNiveau(n) > xp) n--;
  const xpNiveau = seuilNiveau(n);
  const xpSuivant = seuilNiveau(n + 1);
  return {
    niveau: n,
    titre: titreNiveau(n),
    xp,
    xpNiveau,
    xpSuivant,
    progression: arrondi((xp - xpNiveau) / (xpSuivant - xpNiveau)),
  };
}

// ─── Outils ───────────────────────────────────────────────────────────────

/// Le jour du club d'un instant, identique à `cleJour` (lib/jour.ts).
///
/// `cleJour` construit un `Intl.DateTimeFormat` à chaque appel : mesuré sous
/// Node 22, 0,25 à 0,8 ms pièce, contre moins de 0,01 ms pour un format
/// construit une fois. Sur les 800 matchs de trois saisons, c'étaient des
/// centaines de millisecondes — plus que tout le reste du calcul. Même
/// fuseau, même format ; `succes.test.ts` vérifie que les deux rendent la
/// même clé, changements d'heure compris.
const FORMAT_JOUR = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const jourDuClub = (d: Date) => FORMAT_JOUR.format(d);

const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/// L'ordre de l'historique : (playedAt, createdAt, id). Les matchs d'une
/// soirée saisie après coup partagent souvent le même playedAt : sans
/// départage, une série changerait d'un rafraîchissement à l'autre.
function chronologique(
  x: { playedAt: Date; createdAt: Date; id: string },
  y: { playedAt: Date; createdAt: Date; id: string },
): number {
  return (
    x.playedAt.getTime() - y.playedAt.getTime() ||
    x.createdAt.getTime() - y.createdAt.getTime() ||
    compareIds(x.id, y.id)
  );
}

type Resultat = "W" | "D" | "L";

function resultatPour(camp: Camp, m: { scoreA: number; scoreB: number }): Resultat {
  const diff = m.scoreA - m.scoreB;
  if (diff === 0) return "D";
  return diff > 0 === (camp === "A") ? "W" : "L";
}

type Franchi = { seuil: number; t: number; matchId: string | null };

/// Un compteur de famille : sa valeur (le cumul, ou le record pour une
/// série ou un maximum) et les paliers franchis, datés au moment où la
/// valeur les a atteints pour la première fois.
type Compteur = { valeur: number; franchis: Franchi[]; paliers: number[] };

function observer(c: Compteur, v: number, le: Date, matchId: string | null) {
  if (v > c.valeur) c.valeur = v;
  while (c.franchis.length < c.paliers.length && v >= c.paliers[c.franchis.length]) {
    c.franchis.push({ seuil: c.paliers[c.franchis.length], t: le.getTime(), matchId });
  }
}

type Etat = {
  c: Record<IdFamille, Compteur>;
  matchs: number;
  victoires: number;
  nuls: number;
  buts: number;
  passes: number;
  hdm: number;
  soirees: number;
  doubles: number;
  triples: number;
  remontadas: number;
  decisifs: number;
  ouvertures: number;
  cages: number;
  cleanSheets: number;
  corrections: number;
  soireesGagnees: number;
  votes: number;
  titres: number;
  saisons: Set<string>;
  // Séries en cours.
  serieVictoires: number;
  serieInvincible: number;
  serieButeur: number;
  serieLundis: number;
  /// Rang, dans le calendrier du club, de la dernière soirée jouée.
  dernierRangCalendrier: number;
  eloActuel: number;
};

function nouvelEtat(): Etat {
  const c = {} as Record<IdFamille, Compteur>;
  for (const f of FAMILLES) c[f.id] = { valeur: 0, franchis: [], paliers: f.paliers };
  // On part de la base : « l'Élo le plus haut atteint » d'un joueur qui n'a
  // fait que descendre, c'est son point de départ.
  c.elo.valeur = ELO_BASE;
  return {
    c,
    matchs: 0, victoires: 0, nuls: 0, buts: 0, passes: 0, hdm: 0, soirees: 0,
    doubles: 0, triples: 0, remontadas: 0, decisifs: 0, ouvertures: 0,
    cages: 0, cleanSheets: 0, corrections: 0, soireesGagnees: 0, votes: 0,
    titres: 0,
    saisons: new Set(),
    serieVictoires: 0, serieInvincible: 0, serieButeur: 0, serieLundis: 0,
    dernierRangCalendrier: -2,
    eloActuel: ELO_BASE,
  };
}

// ─── Soirées ──────────────────────────────────────────────────────────────

type Soiree = {
  cle: string;
  annulee: boolean;
  /// Ses matchs INTERNAL, dans l'ordre.
  matchs: MatchHistorique[];
  /// Qui l'a jouée : son premier match, et ses matchs par camp.
  presences: Map<string, { premierMatch: MatchHistorique; a: number; b: number }>;
  buts: Map<string, number>;
  premierBut: Map<string, MatchHistorique>;
};

/// Une soirée = les matchs INTERNAL terminés qui partagent un matchDayId ;
/// à défaut, le même jour au club. Un match sans soirée joué le jour d'une
/// soirée existante la rejoint (c'est ce que fait la saisie depuis le lot
/// 0007) : sinon ce lundi compterait pour deux soirées.
function regrouperSoirees(internes: MatchHistorique[], annulees: Set<string>) {
  const sansSoiree = internes.some((m) => m.matchDayId === null);
  const jourVersSoiree = new Map<string, string>();
  const jours = new Map<string, string>();
  if (sansSoiree) {
    for (const m of internes) {
      const j = jourDuClub(m.playedAt);
      jours.set(m.id, j);
      if (m.matchDayId && !jourVersSoiree.has(j)) jourVersSoiree.set(j, m.matchDayId);
    }
  }
  const soirees = new Map<string, Soiree>();
  const parMatch = new Map<string, Soiree>();
  for (const m of internes) {
    const cle =
      m.matchDayId ??
      jourVersSoiree.get(jours.get(m.id)!) ??
      `jour:${jours.get(m.id)}`;
    let s = soirees.get(cle);
    if (!s) {
      s = {
        cle,
        annulee: annulees.has(cle),
        matchs: [],
        presences: new Map(),
        buts: new Map(),
        premierBut: new Map(),
      };
      soirees.set(cle, s);
    }
    s.matchs.push(m);
    parMatch.set(m.id, s);
  }
  return { liste: [...soirees.values()], parMatch };
}

// ─── Ordre des buts ───────────────────────────────────────────────────────

type LectureOrdre = {
  ouvreur: string | null;
  decisif: string | null;
  /// Le plus grand retard subi par chaque camp au fil du match.
  retard: Record<Camp, number>;
};

/// Rejoue le score but par but, si la feuille le permet.
///
/// « Minuté » : chaque but a sa minute, et aucune correction n'a touché le
/// match (une correction pose un but sans minute en fin de chronologie). Et
/// le score rejoué doit retomber sur le score final : une feuille
/// incohérente ne raconte pas d'histoire fiable.
export function lireOrdreDesButs(m: MatchHistorique): LectureOrdre | null {
  if (m.correctedAt) return null;
  const buts = m.events.filter((e) => e.type === "GOAL" || e.type === "OWN_GOAL");
  if (buts.length === 0 || buts.some((e) => e.minute === null)) return null;
  buts.sort(
    (x, y) =>
      x.minute! - y.minute! ||
      x.createdAt.getTime() - y.createdAt.getTime() ||
      compareIds(x.id, y.id),
  );
  let a = 0;
  let b = 0;
  const retard = { A: 0, B: 0 };
  for (const e of buts) {
    if (e.team === "A") a++;
    else b++;
    retard.A = Math.max(retard.A, b - a);
    retard.B = Math.max(retard.B, a - b);
  }
  if (a !== m.scoreA || b !== m.scoreB) return null;

  // Un CSC qui ouvre le score n'ouvre le score pour personne.
  const ouvreur = buts[0].type === "GOAL" ? buts[0].playerId : null;

  // Le but de la victoire : le (l + 1)-ième du vainqueur, l étant le score
  // final du perdant. Après lui, le vainqueur ne sera plus jamais rejoint.
  let decisif: string | null = null;
  if (a !== b) {
    const vainqueur: Camp = a > b ? "A" : "B";
    const perdant = Math.min(a, b);
    let n = 0;
    for (const e of buts) {
      if (e.team !== vainqueur) continue;
      n++;
      if (n === perdant + 1) {
        decisif = e.type === "GOAL" ? e.playerId : null;
        break;
      }
    }
  }
  return { ouvreur, decisif, retard };
}

// ─── Tableau (le même que l'accueil) ──────────────────────────────────────

type Ligne = {
  playerId: string;
  name: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  goals: number;
  assists: number;
  mvpCount: number;
};

/// Les lignes du tableau sur un lot de matchs, avec les règles de
/// `getLeaderboard` (lib/stats.ts) : une ligne naît d'une participation,
/// d'un but, d'une passe, d'un CSC, d'un carton ou d'un titre d'homme du
/// match. Un seul tableau, sinon le rang annoncé ici contredirait l'accueil.
function lignesDuTableau(
  matchs: MatchHistorique[],
  joueurs: Map<string, JoueurHistorique>,
): Map<string, Ligne> {
  const lignes = new Map<string, Ligne>();
  const ligne = (id: string | null): Ligne | null => {
    if (!id) return null;
    const p = joueurs.get(id);
    if (!p) return null;
    let l = lignes.get(id);
    if (!l) {
      l = {
        playerId: id, name: p.name, matchesPlayed: 0, wins: 0, draws: 0,
        goals: 0, assists: 0, mvpCount: 0,
      };
      lignes.set(id, l);
    }
    return l;
  };
  for (const m of matchs) {
    for (const part of m.participants) {
      const l = ligne(part.playerId);
      if (!l) continue;
      l.matchesPlayed++;
      const r = resultatPour(part.initialTeam, m);
      if (r === "W") l.wins++;
      else if (r === "D") l.draws++;
    }
    for (const e of m.events) {
      if (e.type === "GOAL") {
        const l = ligne(e.playerId);
        if (l) l.goals++;
        const p = ligne(e.assistPlayerId);
        if (p) p.assists++;
      } else if (e.type === "OWN_GOAL" || e.type === "YELLOW_CARD" || e.type === "RED_CARD") {
        ligne(e.playerId);
      }
    }
    const h = ligne(m.mvpId);
    if (h) h.mvpCount++;
  }
  return lignes;
}

/// Les titres d'une saison close, départagés comme `getSeasonHonours`
/// (lib/stats.ts) : ordre des buteurs, puis le premier qui fait strictement
/// mieux. Le palmarès affiché sur l'écran Stats et celui compté ici sont le
/// même.
function titresDeSaison(lignes: Map<string, Ligne>): string[] {
  const pct = (l: Ligne) =>
    l.matchesPlayed > 0 ? Math.round((l.wins / l.matchesPlayed) * 100) : 0;
  const rangees = [...lignes.values()].sort(
    (x, y) =>
      y.goals - x.goals ||
      pct(y) - pct(x) ||
      y.matchesPlayed - x.matchesPlayed ||
      x.name.localeCompare(y.name),
  );
  const meilleur = (valeur: (l: Ligne) => number): string | null => {
    let top: Ligne | null = null;
    for (const l of rangees) if (!top || valeur(l) > valeur(top)) top = l;
    return top && valeur(top) > 0 ? top.playerId : null;
  };
  return [meilleur((l) => l.goals), meilleur((l) => l.assists), meilleur((l) => l.mvpCount)]
    .filter((id): id is string => id !== null);
}

// ─── Le calcul ────────────────────────────────────────────────────────────

/// Tout le club, d'un seul passage.
///
/// `maintenant` borne le fil (30 jours en arrière, rien au-delà de demain)
/// et le choix de la dernière soirée : passé en argument pour que les tests
/// ne dépendent pas de l'horloge.
export function calculerSucces(h: Historique, maintenant: Date = new Date()): ResultatSucces {
  const horizon = maintenant.getTime() + MARGE_FUTUR_MS;
  const joueurs = new Map(h.joueurs.map((j) => [j.id, j]));
  const etats = new Map<string, Etat>();
  for (const j of h.joueurs) etats.set(j.id, nouvelEtat());
  const etat = (id: string | null) => (id ? etats.get(id) : undefined);

  const M = h.matchs.filter((m) => m.status === "FINISHED").sort(chronologique);
  const internes = M.filter((m) => m.kind === "INTERNAL");
  const { liste: soirees, parMatch: soireeDe } = regrouperSoirees(
    internes,
    new Set(h.soireesAnnulees),
  );

  // Élo : carrière, matchs INTERNAL, rejoué une fois pour tous. `computeElo`
  // saute les matchs à un côté vide et rend la cote APRÈS chaque match du
  // joueur : on rejoue le même filtre dans le même ordre pour rattacher
  // chaque cote à son match.
  const pourElo = internes
    .map((m) => ({
      m,
      teamA: m.participants.filter((p) => p.initialTeam === "A").map((p) => p.playerId),
      teamB: m.participants.filter((p) => p.initialTeam === "B").map((p) => p.playerId),
    }))
    .filter((x) => x.teamA.length > 0 && x.teamB.length > 0);
  const historiquesElo = computeElo(
    pourElo.map(({ m, teamA, teamB }) => ({ teamA, teamB, scoreA: m.scoreA, scoreB: m.scoreB })),
    ELO_BASE,
  );
  const eloApres = new Map<string, Map<string, number>>();
  {
    const rang = new Map<string, number>();
    for (const { m, teamA, teamB } of pourElo) {
      const cotes = new Map<string, number>();
      for (const id of [...teamA, ...teamB]) {
        const i = rang.get(id) ?? 0;
        rang.set(id, i + 1);
        const cote = historiquesElo.get(id)?.[i];
        if (cote !== undefined) cotes.set(id, cote);
      }
      eloApres.set(m.id, cotes);
    }
  }

  const duos = new Map<string, number>();

  // ── Passage chronologique, match par match ─────────────────────────────
  for (const m of M) {
    const le = m.playedAt;
    const soiree = soireeDe.get(m.id) ?? null;
    const cumulee =
      soiree !== null && soiree.matchs.length === 1 && m.scoreA + m.scoreB >= SEUIL_CUMULEE;

    // Buts, passes, duos. Un but compte même quand son auteur n'est pas sur
    // la feuille (possible sur un EXTERNAL) : c'est la règle de
    // `getLeaderboard`, donc du chiffre « Buts » de la fiche.
    const butsDuMatch = new Map<string, number>();
    for (const e of m.events) {
      if (e.type !== "GOAL") continue;
      const buteur = etat(e.playerId);
      if (buteur) {
        buteur.buts++;
        observer(buteur.c.buteur, buteur.buts, le, m.id);
        butsDuMatch.set(e.playerId!, (butsDuMatch.get(e.playerId!) ?? 0) + 1);
        if (soiree) {
          const n = (soiree.buts.get(e.playerId!) ?? 0) + 1;
          soiree.buts.set(e.playerId!, n);
          if (!soiree.premierBut.has(e.playerId!)) soiree.premierBut.set(e.playerId!, m);
          observer(buteur.c["soiree-de-buteur"], n, le, m.id);
        }
      }
      const passeur = etat(e.assistPlayerId);
      if (passeur) {
        passeur.passes++;
        observer(passeur.c.passeur, passeur.passes, le, m.id);
      }
      if (buteur && passeur && e.playerId !== e.assistPlayerId) {
        const cle = `${e.assistPlayerId}>${e.playerId}`;
        const n = (duos.get(cle) ?? 0) + 1;
        duos.set(cle, n);
        observer(buteur.c.duo, n, le, m.id);
        observer(passeur.c.duo, n, le, m.id);
      }
    }
    if (!cumulee) {
      for (const [id, n] of butsDuMatch) {
        const j = etats.get(id)!;
        if (n >= 2) observer(j.c.double, ++j.doubles, le, m.id);
        if (n >= 3) observer(j.c.triple, ++j.triples, le, m.id);
      }
    }

    const hdm = etat(m.mvpId);
    if (hdm) observer(hdm.c["homme-du-match"], ++hdm.hdm, le, m.id);

    // Ce que rapporte le fait d'être sur la feuille.
    const ecart = Math.abs(m.scoreA - m.scoreB);
    for (const part of m.participants) {
      const j = etats.get(part.playerId);
      if (!j) continue;
      j.matchs++;
      observer(j.c["premiers-pas"], j.matchs, le, m.id);
      observer(j.c.centurion, j.matchs, le, m.id);

      const r = resultatPour(part.initialTeam, m);
      if (r === "W") {
        observer(j.c.victoires, ++j.victoires, le, m.id);
        j.serieVictoires++;
        if (!cumulee && ecart >= ECART_CORRECTION) {
          observer(j.c["victoire-large"], ++j.corrections, le, m.id);
        }
      } else {
        j.serieVictoires = 0;
      }
      if (r === "D") j.nuls++;
      j.serieInvincible = r === "L" ? 0 : j.serieInvincible + 1;
      observer(j.c["serie-victoires"], j.serieVictoires, le, m.id);
      observer(j.c.invincible, j.serieInvincible, le, m.id);

      if (m.seasonId && !j.saisons.has(m.seasonId)) {
        j.saisons.add(m.seasonId);
        observer(j.c.veteran, j.saisons.size, le, m.id);
      }

      // Les cages : ce que dit la feuille (`isGk`), au dedans comme au
      // dehors. Le contrat range les matchs EXTERNAL dans les cumuls
      // (principe 5), et une fiche qui compte les buts d'un tournoi
      // extérieur mais pas les cages du même tournoi se contredit d'une
      // ligne à l'autre — « Muraille : 0 » à un gardien qui vient d'en
      // garder trente. Écart assumé avec `getGardiens` (lib/stats.ts), qui
      // ne classe que les soirées entre nous : c'est un tableau du club, pas
      // la carrière d'un joueur.
      if (part.isGk) {
        observer(j.c.muraille, ++j.cages, le, m.id);
        const encaisses = part.initialTeam === "A" ? m.scoreB : m.scoreA;
        if (!cumulee && encaisses === 0) {
          observer(j.c["clean-sheet"], ++j.cleanSheets, le, m.id);
        }
      }

      if (soiree) {
        const pr = soiree.presences.get(part.playerId);
        if (pr) {
          if (part.initialTeam === "A") pr.a++;
          else pr.b++;
        } else {
          soiree.presences.set(part.playerId, {
            premierMatch: m,
            a: part.initialTeam === "A" ? 1 : 0,
            b: part.initialTeam === "B" ? 1 : 0,
          });
        }
      }
    }

    // L'ordre des buts, sur les feuilles qui le permettent.
    const ordre = cumulee ? null : lireOrdreDesButs(m);
    if (ordre) {
      const ouvreur = etat(ordre.ouvreur);
      if (ouvreur) observer(ouvreur.c.ouvreur, ++ouvreur.ouvertures, le, m.id);
      const decisif = etat(ordre.decisif);
      if (decisif) observer(decisif.c["but-de-la-victoire"], ++decisif.decisifs, le, m.id);
      if (m.scoreA !== m.scoreB) {
        const vainqueur: Camp = m.scoreA > m.scoreB ? "A" : "B";
        if (ordre.retard[vainqueur] >= RETARD_REMONTADA) {
          for (const part of m.participants) {
            if (part.initialTeam !== vainqueur) continue;
            const j = etats.get(part.playerId);
            if (j) observer(j.c.remontada, ++j.remontadas, le, m.id);
          }
        }
      }
    }

    const cotes = eloApres.get(m.id);
    if (cotes) {
      for (const [id, cote] of cotes) {
        const j = etats.get(id);
        if (!j) continue;
        j.eloActuel = cote;
        observer(j.c.elo, cote, le, m.id);
      }
    }
  }

  // ── Passage soirée par soirée ───────────────────────────────────────────
  // Le calendrier de « Toujours là » : les soirées qui ont eu lieu. Une
  // soirée annulée, ou jamais saisie, n'y est pas — elle ne casse rien.
  //
  // Une soirée annulée où des matchs ont quand même été terminés (terrain
  // fermé, quatre joueurs jouent quand même, un admin saisit la feuille) est
  // traitée à dessein de deux façons : elle compte comme soirée JOUÉE
  // (Habitué, Roi du lundi, Buteur en série — on y était), mais elle n'a pas
  // de rang au CALENDRIER, donc « Toujours là » la saute sans casser la
  // série. Les deux compteurs ne mesurent pas la même chose, et « 3 soirées
  // jouées » avec « 2 soirées d'affilée » n'est pas une contradiction : il
  // n'y a eu que deux soirées au calendrier.
  let rangCalendrier = -1;
  for (const s of soirees) {
    if (!s.annulee) rangCalendrier++;
    const dernierMatch = s.matchs[s.matchs.length - 1];
    let victoiresA = 0;
    let victoiresB = 0;
    for (const m of s.matchs) {
      if (m.scoreA > m.scoreB) victoiresA++;
      else if (m.scoreB > m.scoreA) victoiresB++;
    }
    const gagnant: Camp | null =
      victoiresA > victoiresB ? "A" : victoiresB > victoiresA ? "B" : null;

    for (const [id, pr] of s.presences) {
      const j = etats.get(id);
      if (!j) continue;
      const debut = pr.premierMatch;
      observer(j.c.habitue, ++j.soirees, debut.playedAt, debut.id);

      const premierBut = s.premierBut.get(id);
      if (premierBut) {
        j.serieButeur++;
        observer(j.c["buteur-en-serie"], j.serieButeur, premierBut.playedAt, premierBut.id);
      } else {
        j.serieButeur = 0;
      }

      if (!s.annulee) {
        j.serieLundis = j.dernierRangCalendrier === rangCalendrier - 1 ? j.serieLundis + 1 : 1;
        j.dernierRangCalendrier = rangCalendrier;
        observer(j.c["lundis-d-affilee"], j.serieLundis, debut.playedAt, debut.id);
      }

      // Son camp de la soirée : celui où il a joué le plus de matchs. À
      // égalité, il n'a pas de camp, et la soirée ne se donne à personne
      // plutôt qu'au hasard.
      const camp: Camp | null = pr.a > pr.b ? "A" : pr.b > pr.a ? "B" : null;
      if (gagnant && camp === gagnant) {
        observer(j.c["roi-du-lundi"], ++j.soireesGagnees, dernierMatch.playedAt, dernierMatch.id);
      }
    }
  }
  const dernierRang = rangCalendrier;

  // ── Votes ───────────────────────────────────────────────────────────────
  const matchParId = new Map(M.map((m) => [m.id, m]));
  const joueurDuCompte = new Map<string, string>();
  for (const j of h.joueurs) if (j.userId) joueurDuCompte.set(j.userId, j.id);
  const votes = h.votes
    .filter((v) => {
      const m = matchParId.get(v.matchId);
      if (!m) return false;
      // La fenêtre s'ancre sur le plus tard de la date de jeu et de la
      // SAISIE. Une soirée du lundi saisie le jeudi (mode rétro) se vote le
      // jeudi soir : ancrée sur `playedAt`, la fenêtre rejetait tous ces
      // votes, et un club qui saisit toujours après coup n'aurait jamais
      // débloqué « Électeur », même avec deux cents votes émis.
      //
      // L'anti-farming tient : voter d'un coup sur cinquante vieilles
      // feuilles reste hors fenêtre, elles ont été saisies il y a longtemps.
      // Et la borne basse ferme le trou inverse — un match daté par erreur
      // en 2028 ne fait plus compter tous les votes du club.
      const ancre = Math.max(m.playedAt.getTime(), m.createdAt.getTime());
      const ecart = v.createdAt.getTime() - ancre;
      return ecart <= FENETRE_VOTE_MS && ecart >= -FENETRE_VOTE_MS;
    })
    .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime() || compareIds(x.matchId, y.matchId));
  for (const v of votes) {
    const j = etat(joueurDuCompte.get(v.voterId) ?? null);
    if (j) observer(j.c.electeur, ++j.votes, v.createdAt, v.matchId);
  }

  // ── Titres des saisons closes ───────────────────────────────────────────
  const saisons = [...h.saisons].sort(
    (x, y) => x.startsAt.getTime() - y.startsAt.getTime() || compareIds(x.id, y.id),
  );
  for (const saison of saisons) {
    if (saison.isActive) continue;
    const matchsSaison = M.filter((m) => m.seasonId === saison.id);
    if (matchsSaison.length === 0) continue;
    // Le titre tombe à la clôture ; à défaut de date de clôture, au dernier
    // match de la saison.
    const le = saison.endsAt ?? matchsSaison[matchsSaison.length - 1].playedAt;
    for (const id of titresDeSaison(lignesDuTableau(matchsSaison, joueurs))) {
      const j = etats.get(id)!;
      observer(j.c["titre-saison"], ++j.titres, le, null);
    }
  }

  // ── Tableau de la saison active, avant et après la dernière soirée ──────
  // Même périmètre que l'accueil : la saison active, ou tout l'historique
  // s'il n'y en a pas.
  const saisonActive = h.saisons.find((s) => s.isActive) ?? null;
  const perimetre = saisonActive ? M.filter((m) => m.seasonId === saisonActive.id) : M;
  const { pointsWin, pointsDraw } = h.reglages;
  const rangs = (matchs: MatchHistorique[]) => {
    const ordre = trierParPoints([...lignesDuTableau(matchs, joueurs).values()], pointsWin, pointsDraw);
    return { ordre, rang: new Map(ordre.map((l, i) => [l.playerId, i + 1])) };
  };
  const apres = rangs(perimetre);
  let avant: Map<string, number> | null = null;
  {
    // « La dernière soirée » se cherche parmi celles qui ont eu lieu : un
    // match daté par erreur dans le futur serait sinon la dernière pour
    // toujours, et « +1 place depuis la dernière soirée » décrirait un
    // fantôme au lieu du dernier lundi.
    const dansPerimetre = perimetre.filter(
      (m) => m.kind === "INTERNAL" && m.playedAt.getTime() <= horizon,
    );
    const derniere = dansPerimetre.length > 0 ? soireeDe.get(dansPerimetre[dansPerimetre.length - 1].id) : undefined;
    if (derniere) {
      const debut = derniere.matchs.find((m) => perimetre.includes(m))!;
      avant = rangs(perimetre.filter((m) => chronologique(m, debut) < 0)).rang;
    }
  }
  const evolutions: Record<string, number> = {};
  if (avant) {
    for (const [id, r] of apres.rang) {
      const r0 = avant.get(id);
      if (r0 !== undefined) evolutions[id] = r0 - r;
    }
  }

  // ── Rareté ──────────────────────────────────────────────────────────────
  // Parmi les joueurs du club qui ont joué : un effectif de quarante noms
  // dont la moitié n'a jamais mis les pieds sur le terrain ferait passer
  // « Premiers pas » pour un exploit.
  const population = h.joueurs.filter(
    (j) => !j.isGuest && !j.isArchived && etats.get(j.id)!.matchs > 0,
  );
  const rarete = new Map<IdFamille, number | null>();
  for (const f of FAMILLES) {
    if (population.length === 0) {
      rarete.set(f.id, null);
      continue;
    }
    const n = population.filter((j) => etats.get(j.id)!.c[f.id].franchis.length > 0).length;
    rarete.set(f.id, arrondi(n / population.length));
  }

  // Les familles qu'un club ne suit pas : « 0 passe » à un club qui ne
  // saisit pas les passes, c'est un reproche, pas un objectif. Un joueur
  // qui y a déjà un palier (réglage changé depuis) le garde.
  const { trackAssists, motmMode } = h.reglages;
  const horsSujet = (id: IdFamille) =>
    (!trackAssists && (id === "passeur" || id === "duo")) ||
    (motmMode === "OFF" && id === "homme-du-match") ||
    (motmMode !== "VOTE" && id === "electeur");

  // ── Assemblage ──────────────────────────────────────────────────────────
  const RANG_MATIERE: Record<Matiere, number> = { bronze: 0, argent: 1, or: 2, platine: 3, legende: 4 };
  /// Un déblocage et de quoi le trier, sans recopier l'objet rendu : les
  /// copies par décomposition (`{ t, ...d }`) et les `toISOString` répétés
  /// pesaient à eux seuls un quart du calcul (profil du 19 septembre 2026,
  /// 792 matchs).
  type Entree = { t: number; famille: number; d: Deblocage; playerId: string; joueur: string };
  const plusRecentDabord = (x: Entree, y: Entree) =>
    y.t - x.t ||
    RANG_MATIERE[y.d.matiere] - RANG_MATIERE[x.d.matiere] ||
    x.famille - y.famille ||
    y.d.palier - x.d.palier;
  /// L'ordre du fil et des déblocages d'un match, jusqu'au bout : deux
  /// joueurs peuvent porter le même NOM (deux Karim au club) et franchir le
  /// même palier le même soir. Sans dernier départage, l'ordre retombait sur
  /// celui de la liste des joueurs, que la base rend comme elle veut — deux
  /// rafraîchissements de l'accueil donnaient deux ordres.
  const parNom = (x: Entree, y: Entree) =>
    x.joueur.localeCompare(y.joueur) || compareIds(x.playerId, y.playerId);
  const isoDe = new Map<number, string>();
  const iso = (t: number) => {
    let s = isoDe.get(t);
    if (s === undefined) {
      s = new Date(t).toISOString();
      isoDe.set(t, s);
    }
    return s;
  };
  const avecJoueur = (e: Entree): DeblocageJoueur => ({ ...e.d, playerId: e.playerId, joueur: e.joueur });

  const parJoueur = new Map<string, SuccesJoueur>();
  const tousLesDeblocages: Entree[] = [];
  const niveaux: SuccesClub["niveaux"] = [];

  for (const joueur of h.joueurs) {
    const j = etats.get(joueur.id)!;
    const entrees: Entree[] = [];
    const badges: Badge[] = [];
    let bonus = 0;
    for (let k = 0; k < FAMILLES.length; k++) {
      const f = FAMILLES[k];
      const c = j.c[f.id];
      for (let i = 0; i < c.franchis.length; i++) {
        const fr = c.franchis[i];
        const matiere = matiereDuPalier(i + 1, f.paliers.length);
        bonus += BONUS_MATIERE[matiere];
        entrees.push({
          t: fr.t,
          famille: k,
          playerId: joueur.id,
          joueur: joueur.name,
          d: {
            badgeId: f.id,
            nom: f.nom,
            icone: f.icone,
            matiere,
            palier: i + 1,
            seuil: fr.seuil,
            libelle: f.libelle(fr.seuil),
            le: iso(fr.t),
            matchId: fr.matchId,
          },
        });
      }
      const palier = c.franchis.length;
      if (palier === 0 && horsSujet(f.id)) continue;
      const dernier = palier > 0 ? c.franchis[palier - 1] : null;
      const prochain = palier < f.paliers.length ? f.paliers[palier] : null;
      badges.push({
        id: f.id,
        nom: f.nom,
        icone: f.icone,
        description: f.description(dernier?.seuil ?? f.paliers[0]),
        paliers: f.paliers,
        palier,
        matiere: palier > 0 ? matiereDuPalier(palier, f.paliers.length) : null,
        valeur: Math.round(c.valeur),
        prochain,
        obtenuLe: dernier ? iso(dernier.t) : null,
        matchId: dernier?.matchId ?? null,
        rarete: rarete.get(f.id) ?? null,
      });
    }
    entrees.sort(plusRecentDabord);

    // La famille la plus proche de son prochain palier. Pour une série, la
    // distance se mesure depuis la série EN COURS (un record de 4 ne met pas
    // « à un pas » de 5 celui qui vient de perdre) ; pour l'Élo, depuis la
    // cote actuelle et la base de 1000, sinon tout nouveau venu serait
    // « à 91 % » d'une cote de 1100.
    const enCours: Partial<Record<IdFamille, number>> = {
      "serie-victoires": j.serieVictoires,
      invincible: j.serieInvincible,
      "buteur-en-serie": j.serieButeur,
      "lundis-d-affilee": j.dernierRangCalendrier === dernierRang ? j.serieLundis : 0,
    };
    let prochain: Badge | null = null;
    let meilleur = -1;
    for (const b of badges) {
      if (b.prochain === null) continue;
      const id = b.id as IdFamille;
      const ratio =
        id === "elo"
          ? Math.max(0, (j.eloActuel - ELO_BASE) / (b.prochain - ELO_BASE))
          : (enCours[id] ?? b.valeur) / b.prochain;
      if (ratio < 1 && ratio > meilleur) {
        meilleur = ratio;
        prochain = b;
      }
    }

    const xpDetail = [
      { source: "Matchs joués", xp: 10 * j.matchs },
      { source: "Victoires", xp: 15 * j.victoires },
      { source: "Nuls", xp: 5 * j.nuls },
      { source: "Buts", xp: 8 * j.buts },
      { source: "Passes décisives", xp: 5 * j.passes },
      { source: "Homme du match", xp: 20 * j.hdm },
      { source: "Soirées", xp: 5 * j.soirees },
      { source: "Succès", xp: bonus },
    ].filter((d) => d.xp > 0);
    const niveau = niveauPourXp(xpDetail.reduce((s, d) => s + d.xp, 0));

    const rang = apres.rang.get(joueur.id) ?? null;
    const ligne = rang !== null ? apres.ordre[rang - 1] : null;
    const devant = rang !== null && rang > 1 ? apres.ordre[rang - 2] : null;

    parJoueur.set(joueur.id, {
      joueur: { id: joueur.id, nom: joueur.name },
      niveau,
      xpDetail,
      series: [
        { id: "victoires", nom: "Victoires d'affilée", enCours: j.serieVictoires, record: j.c["serie-victoires"].valeur },
        { id: "invincible", nom: "Sans défaite", enCours: j.serieInvincible, record: j.c.invincible.valeur },
        { id: "buteur", nom: "Buteur en série", enCours: j.serieButeur, record: j.c["buteur-en-serie"].valeur },
        { id: "lundis", nom: "Toujours là", enCours: enCours["lundis-d-affilee"]!, record: j.c["lundis-d-affilee"].valeur },
      ],
      badges,
      deblocages: entrees.map((e) => e.d),
      prochain,
      classement: {
        rang,
        total: apres.ordre.length,
        points: ligne ? points(ligne, pointsWin, pointsDraw) : 0,
        evolution: evolutions[joueur.id] ?? null,
        devant: devant ? { nom: devant.name, points: points(devant, pointsWin, pointsDraw) } : null,
      },
    });

    for (const e of entrees) tousLesDeblocages.push(e);
    if (!joueur.isGuest && !joueur.isArchived && niveau.xp > 0) {
      niveaux.push({
        playerId: joueur.id,
        nom: joueur.name,
        niveau: niveau.niveau,
        titre: niveau.titre,
        xp: niveau.xp,
      });
    }
  }

  niveaux.sort((x, y) => y.xp - x.xp || x.nom.localeCompare(y.nom));

  // ── Raretés ─────────────────────────────────────────────────────────────
  // Le palier le plus HAUT que le club détient dans une famille, et qui le
  // tient. `Badge.rarete` se lit au premier palier : dans un club qui tourne
  // depuis deux saisons, tout le monde a son « Buteur » bronze, et ce qui se
  // raconte c'est l'or que Bakary est seul à avoir.
  //
  // La règle vit ici, une seule fois, parce que les deux vitrines en
  // disaient deux choses différentes : le site comptait le palier le plus
  // haut, l'app repliait sur la part du club qui a le premier palier. Les
  // écrans n'ont plus qu'à dessiner ces lignes.
  //
  // On compte parmi `niveaux` — ni invités, ni archivés, ni joueurs à zéro.
  const raretes: Rarete[] = [];
  if (niveaux.length > 0) {
    for (const f of FAMILLES) {
      let palier = 0;
      let detenteurs: { playerId: string; nom: string }[] = [];
      for (const n of niveaux) {
        const p = etats.get(n.playerId)!.c[f.id].franchis.length;
        if (p === 0 || p < palier) continue;
        if (p > palier) {
          palier = p;
          detenteurs = [];
        }
        detenteurs.push({ playerId: n.playerId, nom: n.nom });
      }
      // Ce que la moitié du club détient n'est pas rare.
      if (palier === 0 || detenteurs.length * 2 > niveaux.length) continue;
      raretes.push({
        badgeId: f.id,
        nom: f.nom,
        icone: f.icone,
        matiere: matiereDuPalier(palier, f.paliers.length),
        palier,
        libelle: f.libelle(f.paliers[palier - 1]),
        detenteurs,
        total: niveaux.length,
      });
    }
    // Le moins détenu d'abord ; à égalité, le métal le plus précieux. La
    // liste est construite dans l'ordre du catalogue, et le tri est stable :
    // c'est lui qui départage en dernier.
    raretes.sort(
      (x, y) =>
        x.detenteurs.length - y.detenteurs.length ||
        RANG_MATIERE[y.matiere] - RANG_MATIERE[x.matiere],
    );
    raretes.length = Math.min(raretes.length, RARETES_MAX);
  }

  // ── Le fil du club ──────────────────────────────────────────────────────
  // Trente jours, et vingt ÉVÉNEMENTS — pas vingt lignes. Les quatre écrans
  // qui l'affichent regroupent un même palier franchi le même jour en UNE
  // ligne (« Toujours là : Bakary, Cédric et 10 autres ») ; coupé à vingt
  // déblocages avant regroupement, le premier lundi de la saison, où tout le
  // club franchit le même palier, effaçait tout le reste du mois. Un groupe
  // voyage donc entier, et un plafond de lignes garde la réponse petite.
  const depuis = maintenant.getTime() - FIL_JOURS * 24 * 3600_000;
  const fil: DeblocageJoueur[] = [];
  {
    const groupes = new Map<string, Entree[]>();
    for (const e of tousLesDeblocages) {
      if (e.t < depuis || e.t > horizon) continue;
      if (joueurs.get(e.playerId)!.isGuest) continue;
      // La même clé que les écrans : famille, palier, jour du club.
      const cle = `${e.d.badgeId}:${e.d.palier}:${jourDuClub(new Date(e.t))}`;
      const g = groupes.get(cle);
      if (g) g.push(e);
      else groupes.set(cle, [e]);
    }
    const liste = [...groupes.values()];
    for (const g of liste) g.sort((x, y) => plusRecentDabord(x, y) || parNom(x, y));
    liste.sort((x, y) => plusRecentDabord(x[0], y[0]) || parNom(x[0], y[0]));
    let evenements = 0;
    for (const g of liste) {
      if (evenements >= FIL_MAX) break;
      // Le premier groupe passe toujours entier : une ligne coupée en deux
      // ne veut rien dire.
      if (evenements > 0 && fil.length + g.length > FIL_LIGNES_MAX) break;
      for (const e of g) fil.push(avecJoueur(e));
      evenements++;
    }
  }

  let parMatch: Map<string, DeblocageJoueur[]> | null = null;
  const deblocagesDuMatch = (matchId: string) => {
    if (!parMatch) {
      parMatch = new Map();
      const tries = tousLesDeblocages
        .filter((e) => e.d.matchId !== null)
        .sort(
          (x, y) =>
            RANG_MATIERE[y.d.matiere] - RANG_MATIERE[x.d.matiere] ||
            x.famille - y.famille ||
            parNom(x, y),
        );
      for (const e of tries) {
        const l = parMatch.get(e.d.matchId!) ?? [];
        l.push(avecJoueur(e));
        parMatch.set(e.d.matchId!, l);
      }
    }
    return parMatch.get(matchId) ?? [];
  };

  return { parJoueur, club: { niveaux, fil, raretes, evolutions }, deblocagesDuMatch };
}
