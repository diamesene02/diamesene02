/// Qui vient lundi.
///
/// Le modèle de départ demandait à chacun de se déclarer chaque semaine.
/// Personne ne le fait : quinze soirées affichaient « 1 réponse ». Pour un
/// groupe d'habitués, la bonne question n'est pas « qui vient ? » mais « qui
/// ne peut pas ? ».
///
/// Trois règles, et rien d'autre :
///   1. une réponse explicite gagne toujours sur l'abonnement ;
///   2. un abonné sans réponse est compté présent ;
///   3. quand il y a plus de présents que de places, l'ordre d'engagement
///      tranche — et l'abonné s'est engagé le jour où la soirée est née.
///
/// Ce module ne lit ni n'écrit la base : il reçoit des lignes et rend un
/// état. C'est ce qui permet de l'appeler depuis l'accueil, la page de la
/// soirée et le calendrier sans trois calculs différents.

export type StatutReponse = "IN" | "OUT" | "MAYBE";

export type EntreePresence = {
  playerId: string;
  /// Réponse explicite, si elle existe.
  reponse: StatutReponse | null;
  /// Quand elle a été donnée.
  repondueLe: Date | null;
  /// Le joueur a dit « je viens tous les lundis ».
  abonne: boolean;
};

export type LignePresence = {
  playerId: string;
  /// Le statut retenu, réponse et abonnement confondus.
  statut: StatutReponse | null;
  /// D'où vient ce statut — pour pouvoir le dire à l'écran plutôt que de
  /// laisser croire à quelqu'un qu'il a répondu alors qu'il n'a rien fait.
  source: "reponse" | "abonnement" | "silence";
  /// Rang parmi les présents : 1..capacite = titulaire, au-delà = en attente.
  rang: number | null;
  enAttente: boolean;
};

export type EtatSoiree =
  | { statut: "annulee" }
  | { statut: "confirmee"; presents: number; places: number | null }
  | { statut: "en-attente"; presents: number; manquants: number };

export type Presences = {
  lignes: Map<string, LignePresence>;
  titulaires: string[];
  attente: string[];
  absents: string[];
  peutEtre: string[];
  sansReponse: string[];
  etat: EtatSoiree;
};

export function calculerPresences(input: {
  entrees: EntreePresence[];
  /// L'instant où la soirée a été créée : c'est la date d'engagement des
  /// abonnés, qui n'ont rien eu à faire cette semaine-là.
  creeeLe: Date;
  minJoueurs: number;
  /// 0 ou moins = pas de liste d'attente.
  capacite: number;
  annulee?: boolean;
}): Presences {
  const { entrees, creeeLe, minJoueurs, capacite, annulee } = input;

  const lignes = new Map<string, LignePresence>();
  const presents: { playerId: string; engageA: number }[] = [];
  const absents: string[] = [];
  const peutEtre: string[] = [];
  const sansReponse: string[] = [];

  for (const e of entrees) {
    const statut: StatutReponse | null =
      e.reponse ?? (e.abonne ? "IN" : null);
    const source: LignePresence["source"] = e.reponse
      ? "reponse"
      : e.abonne
        ? "abonnement"
        : "silence";
    lignes.set(e.playerId, {
      playerId: e.playerId,
      statut,
      source,
      rang: null,
      enAttente: false,
    });
    if (statut === "IN") {
      presents.push({
        playerId: e.playerId,
        engageA: (e.repondueLe ?? creeeLe).getTime(),
      });
    } else if (statut === "OUT") absents.push(e.playerId);
    else if (statut === "MAYBE") peutEtre.push(e.playerId);
    else sansReponse.push(e.playerId);
  }

  // Premier engagé, première place. Les abonnés partagent l'instant de
  // création : entre eux, l'ordre d'affichage suffit — ils sont tous là
  // depuis le début, aucun n'a plus de droit que l'autre.
  presents.sort((a, b) => a.engageA - b.engageA);

  const limite = capacite > 0 ? capacite : presents.length;
  const titulaires: string[] = [];
  const attente: string[] = [];
  presents.forEach((p, i) => {
    const l = lignes.get(p.playerId);
    if (l) {
      l.rang = i + 1;
      l.enAttente = i >= limite;
    }
    (i >= limite ? attente : titulaires).push(p.playerId);
  });

  const etat: EtatSoiree = annulee
    ? { statut: "annulee" }
    : titulaires.length >= minJoueurs
      ? {
          statut: "confirmee",
          presents: titulaires.length,
          places: capacite > 0 ? Math.max(0, capacite - titulaires.length) : null,
        }
      : {
          statut: "en-attente",
          presents: titulaires.length,
          manquants: minJoueurs - titulaires.length,
        };

  return { lignes, titulaires, attente, absents, peutEtre, sansReponse, etat };
}

/// La phrase courte que portent l'accueil, le calendrier et la bannière.
export function phraseEtat(etat: EtatSoiree): string {
  if (etat.statut === "annulee") return "Annulée";
  if (etat.statut === "en-attente") {
    return `${etat.presents} présent${etat.presents > 1 ? "s" : ""} · il en manque ${etat.manquants}`;
  }
  if (etat.places === 0) return `${etat.presents} présents · complet`;
  if (etat.places == null) return `${etat.presents} présents · c'est bon`;
  return `${etat.presents} présents · ${etat.places} place${etat.places > 1 ? "s" : ""}`;
}
