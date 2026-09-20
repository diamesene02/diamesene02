// Les succès du joueur, tels que le serveur les calcule.
//
// Les types sont une COPIE CONFORME de five-scorer/lib/succes.ts (l'app ne
// peut pas importer le site) : le serveur rend ces formes-là, champ pour
// champ. Tout se calcule là-bas, à chaque lecture, depuis les matchs
// terminés — l'app ne recompte rien, elle dessine.
//
// Les routes (five-scorer/app/api/clubs/[clubId]/succes/**) :
//   GET …/succes[?joueur=<id>]      → SuccesJoueur, ou { joueur: null }
//   GET …/succes/club               → SuccesClub
//   GET …/succes/match/<matchId>    → { deblocages }

export type Matiere = "bronze" | "argent" | "or" | "platine" | "legende";
export type IconeSucces =
  | "debut" | "ballon" | "passe" | "double" | "chapeau" | "feu" | "serie"
  | "etoile" | "victoire" | "eclair" | "bouclier" | "couronne" | "maillot"
  | "lundi" | "calendrier" | "remontada" | "decisif" | "ouvreur" | "gant"
  | "mur" | "fessee" | "elo" | "duo" | "veteran" | "vote" | "titre";

export type Badge = {
  id: string;              // id de famille, ex. "buteur"
  nom: string;             // « Buteur »
  icone: IconeSucces;
  description: string;     // phrase courte : « 10 buts en carrière »
  paliers: number[];       // [1, 5, 10, 25, ...]
  palier: number;          // nombre de paliers obtenus (0 = aucun)
  matiere: Matiere | null; // matière du dernier palier obtenu, null si aucun
  valeur: number;          // compteur actuel (ou record pour les séries/max)
  prochain: number | null; // seuil du prochain palier, null si tout est pris
  obtenuLe: string | null; // ISO du dernier palier obtenu
  matchId: string | null;  // match qui a déclenché le dernier palier
  rarete: number | null;   // part des joueurs du club (non invités, ayant joué) qui ont au moins le 1er palier, 0..1
};

export type Deblocage = {
  badgeId: string; nom: string; icone: IconeSucces; matiere: Matiere;
  palier: number;          // rang du palier (1 = bronze)
  seuil: number;           // la valeur franchie, ex. 10
  libelle: string;         // « 10 buts »
  le: string;              // ISO
  matchId: string | null;
};

export type Niveau = {
  niveau: number; titre: string; xp: number;
  xpNiveau: number;        // seuil du niveau actuel
  xpSuivant: number;       // seuil du niveau suivant
  progression: number;     // 0..1 vers le niveau suivant
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
  badges: Badge[];                 // l'ordre du catalogue ; sans les familles que le club ne suit pas
  deblocages: Deblocage[];         // tous les paliers obtenus, le plus récent d'abord
  prochain: Badge | null;          // la famille la plus proche de son prochain palier
  classement: {                    // saison active, barème du club
    rang: number | null; total: number; points: number;
    evolution: number | null;      // places gagnées (+) ou perdues (−) depuis AVANT la dernière soirée
    devant: { nom: string; points: number } | null;
  };
};

export type DeblocageJoueur = Deblocage & { playerId: string; joueur: string };

/// Une ligne de l'onglet « Raretés » : le palier le plus HAUT que le club
/// détient dans une famille, et qui le tient. Le serveur la calcule (une
/// seule définition pour le site et l'app) ; l'écran ne fait que l'afficher.
export type Rarete = {
  badgeId: string;
  nom: string;
  icone: IconeSucces;
  matiere: Matiere;
  palier: number;          // rang de ce palier (1 = bronze)
  libelle: string;         // « 25 buts »
  detenteurs: { playerId: string; nom: string }[];
  total: number;           // le nombre de joueurs parmi lesquels on compte
};

export type SuccesClub = {
  niveaux: { playerId: string; nom: string; niveau: number; titre: string; xp: number }[];
  // 30 derniers jours, le plus récent d'abord, 20 ÉVÉNEMENTS au plus (une
  // famille, un palier, un jour) : les déblocages d'un même événement
  // arrivent ensemble, à la suite, pour que `grouperFil` en fasse une ligne.
  fil: DeblocageJoueur[];
  raretes: Rarete[];                   // les cinq plus rares du club, prêtes à afficher
  evolutions: Record<string, number>;  // playerId → places gagnées depuis avant la dernière soirée
};

/// Ce que rend `chargerSucces` sans joueur désigné : le compte n'a peut-être
/// pas de profil dans ce club (un dirigeant qui ne joue pas).
export type ReponseSucces = SuccesJoueur | { joueur: null };

/// L'appel authentifié, chargé à la demande.
///
/// `./api` tire expo-constants et expo-linking : importé en tête, il rendrait
/// ce fichier — et l'état « vu » qui s'y greffe — intestable sous vitest.
/// Même précédent que `lireCookie` dans api.ts, qui charge le client
/// d'authentification au moment de l'appel.
async function appel<T>(chemin: string): Promise<T> {
  const { appelAuthentifie } = await import("./api");
  return appelAuthentifie<T>(chemin);
}

/// Mes succès (ou ceux d'un joueur du club, pour sa fiche).
export function chargerSucces(clubId: string, joueurId?: string): Promise<ReponseSucces> {
  const q = joueurId ? `?joueur=${encodeURIComponent(joueurId)}` : "";
  return appel<ReponseSucces>(`/api/clubs/${encodeURIComponent(clubId)}/succes${q}`);
}

export function chargerSuccesClub(clubId: string): Promise<SuccesClub> {
  return appel<SuccesClub>(`/api/clubs/${encodeURIComponent(clubId)}/succes/club`);
}

/// Les paliers franchis pendant un match, pour son récap.
export function chargerSuccesMatch(
  clubId: string,
  matchId: string,
): Promise<{ deblocages: DeblocageJoueur[] }> {
  return appel<{ deblocages: DeblocageJoueur[] }>(
    `/api/clubs/${encodeURIComponent(clubId)}/succes/match/${encodeURIComponent(matchId)}`,
  );
}
