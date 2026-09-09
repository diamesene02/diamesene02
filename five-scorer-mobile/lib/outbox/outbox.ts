// La file d'attente elle-même : enfiler, lire la suivante, marquer, compter.
//
// Le SQL vit ici, et nulle part ailleurs. « sync.ts » au-dessus ne connaît que
// ces fonctions, ce qui laisse le drain lisible comme une machine à états
// plutôt que comme un tas de requêtes.
//
// Deux règles portées telles quelles de la version Dexie :
//
//   1. **L'ordre se prend sur « id », jamais sur « created_at ».** L'horodatage
//      vient de l'horloge du téléphone, qui peut reculer (correction NTP,
//      changement de fuseau, réglage manuel). Un recul suffisait à faire passer
//      le `finishMatch` devant des buts encore en file — et le serveur refuse
//      ensuite d'écrire dans un match terminé, ce qui gèle toute la chaîne.
//   2. **Une opération refusée est marquée, jamais supprimée.** On ne détruit
//      pas la saisie d'une soirée sans le dire.

import type { Base } from "./base";
import type { OutboxEntry, OutboxOp } from "./types";

/// La ligne telle que SQLite la rend. Les colonnes sont en serpent_minuscule
/// (règle 2 de l'entête de db/schema.sql) ; la conversion vers les noms
/// TypeScript se fait juste en dessous, à un seul endroit.
type LigneOutbox = {
  id: number;
  created_at: string;
  attempts: number;
  last_error: string | null;
  blocked_at: string | null;
  match_id: string | null;
  club_id: string;
  op: string;
};

function versEntree(l: LigneOutbox): OutboxEntry {
  return {
    id: l.id,
    createdAt: l.created_at,
    attempts: l.attempts,
    lastError: l.last_error,
    blockedAt: l.blocked_at,
    op: JSON.parse(l.op) as OutboxOp,
  };
}

/// Ajoute une mutation à la file. Rend l'identifiant attribué — c'est lui qui
/// fixe la place dans la file, définitivement.
///
/// `match_id` est extrait du JSON et monté en colonne : c'est par lui que le
/// refus d'une opération bloque en cascade toutes celles du même match.
export async function enfiler(
  base: Base,
  op: OutboxOp,
  quand: string,
): Promise<number> {
  const r = await base.executer(
    "INSERT INTO outbox (created_at, attempts, match_id, club_id, op) VALUES (?, 0, ?, ?, ?)",
    [quand, op.matchId ?? null, op.clubId, JSON.stringify(op)],
  );
  return r.dernierId;
}

/// La prochaine opération à rejouer, ou `null` si la file active est vide.
///
/// Les opérations bloquées sont écartées : sans ce filtre, la première d'entre
/// elles resterait en tête et ferait tourner le drain en boucle.
export async function prochaineActive(base: Base): Promise<OutboxEntry | null> {
  const l = await base.premier<LigneOutbox>(
    "SELECT * FROM outbox WHERE blocked_at IS NULL ORDER BY id ASC LIMIT 1",
  );
  return l ? versEntree(l) : null;
}

/// Une opération acceptée par le serveur sort de la file. C'est la seule
/// suppression de tout le fichier.
export async function retirer(base: Base, id: number): Promise<void> {
  await base.executer("DELETE FROM outbox WHERE id = ?", [id]);
}

/// Échec réessayable : on compte la tentative et on garde l'opération en tête
/// de file. Le compteur sert au diagnostic, pas à abandonner — une file qui
/// abandonne, c'est une soirée perdue.
export async function noterEchec(
  base: Base,
  id: number,
  message: string,
): Promise<void> {
  await base.executer(
    "UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?",
    [message, id],
  );
}

/// Refus du serveur (403, 404, 409…) : on bloque TOUTE la chaîne du match, pas
/// seulement l'opération refusée.
///
/// Laisser passer les suivantes reviendrait à exécuter `finishMatch` par-dessus
/// un `addEvent` refusé : le match basculerait terminé côté serveur, et
/// l'opération bloquée deviendrait définitivement irrécupérable — son rejeu se
/// heurterait au refus « match terminé ».
///
/// Rend le nombre d'opérations mises de côté (au moins 1 : celle qui a été
/// refusée).
export async function bloquerChaine(
  base: Base,
  entree: OutboxEntry,
  quand: string,
  motif: string,
): Promise<number> {
  const matchId = entree.op.matchId;
  if (matchId) {
    const r = await base.executer(
      "UPDATE outbox SET blocked_at = ?, last_error = ? WHERE match_id = ? AND blocked_at IS NULL",
      [quand, motif, matchId],
    );
    return r.modifiees;
  }
  // Une opération sans match : elle seule est mise de côté. Le cas n'existe pas
  // aujourd'hui — les huit variantes d'OutboxOp portent un matchId — mais la
  // colonne accepte NULL, donc le code doit répondre quelque chose de sûr.
  const r = await base.executer(
    "UPDATE outbox SET blocked_at = ?, last_error = ? WHERE id = ?",
    [quand, motif, entree.id ?? null],
  );
  return r.modifiees;
}

/// Les deux nombres de la pastille. `enAttente` ne compte que ce qui partira
/// tout seul ; `bloquees` ce qui exige une intervention. Les confondre revenait
/// à afficher « Synchro OK » sur une file pleine d'opérations refusées.
export async function compteurs(
  base: Base,
): Promise<{ enAttente: number; bloquees: number }> {
  const l = await base.premier<{ actives: number; bloquees: number }>(
    "SELECT COUNT(*) FILTER (WHERE blocked_at IS NULL) AS actives, " +
      "COUNT(*) FILTER (WHERE blocked_at IS NOT NULL) AS bloquees FROM outbox",
  );
  return { enAttente: l?.actives ?? 0, bloquees: l?.bloquees ?? 0 };
}

/// Les opérations refusées, pour l'écran de diagnostic.
export async function listerBloquees(base: Base): Promise<OutboxEntry[]> {
  const lignes = await base.lire<LigneOutbox>(
    "SELECT * FROM outbox WHERE blocked_at IS NOT NULL ORDER BY id ASC",
  );
  return lignes.map(versEntree);
}

/// Remet les opérations bloquées dans la file — après une reconnexion, ou une
/// fois les droits rétablis par un admin. Le compteur de tentatives repart à
/// zéro : ce n'est plus la même histoire.
export async function debloquerToutes(base: Base): Promise<number> {
  const r = await base.executer(
    "UPDATE outbox SET blocked_at = NULL, attempts = 0 WHERE blocked_at IS NOT NULL",
  );
  return r.modifiees;
}
