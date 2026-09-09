// Les cinq tables du miroir local, et rien d'autre : lire une ligne, en écrire
// une, changer un champ.
//
// C'est à « lib/match/local.ts » ce que « lib/outbox/outbox.ts » est à
// « lib/outbox/sync.ts » — le SQL vit ici, la logique métier vit au-dessus. La
// raison est la même qu'à l'étape 7 : la machine à états se relit comme une
// machine à états, pas comme un tas de requêtes.
//
// Deux règles, qui expliquent la forme du fichier :
//
//   1. **La conversion serpent_minuscule ↔ casseChameau ne vit qu'ici.**
//      C'est la règle 2 de l'entête de « db/schema.sql ». Une conversion
//      dispersée est une faute de portage qui attend son lundi soir.
//   2. **`ecrire*` remplace la ligne entière**, comme le `put` de Dexie qu'il
//      remplace : les champs absents de l'objet retombent au défaut du schéma,
//      ils ne sont pas conservés. `maj*` ne touche que les colonnes nommées,
//      comme `Table.update`. Confondre les deux, c'est perdre un score en
//      remettant à jour un match.

import type { Base } from "../outbox/base";
import type {
  LocalClub,
  LocalEvent,
  LocalMatch,
  LocalParticipant,
  LocalPlayer,
} from "../outbox/types";

/// La clé composée des participants, telle quelle depuis Dexie.
export function pKey(matchId: string, playerId: string): string {
  return `${matchId}::${playerId}`;
}

/// SQLite n'a pas de booléen : chaque colonne concernée porte un
/// `CHECK IN (0, 1)` dans « db/schema.sql ».
function b(v: boolean | undefined): number {
  return v ? 1 : 0;
}

function versBooleen(v: number): boolean {
  return v === 1;
}

// --- clubs ------------------------------------------------------------------

type LigneClub = {
  id: string;
  slug: string;
  name: string;
  color_a: string | null;
  color_b: string | null;
  track_assists: number;
  track_cards: number;
  motm_mode: LocalClub["motmMode"];
  match_duration_min: number;
  saved_at: string;
};

function versClub(l: LigneClub): LocalClub {
  return {
    id: l.id,
    slug: l.slug,
    name: l.name,
    colorA: l.color_a,
    colorB: l.color_b,
    trackAssists: versBooleen(l.track_assists),
    trackCards: versBooleen(l.track_cards),
    motmMode: l.motm_mode,
    matchDurationMin: l.match_duration_min,
    savedAt: l.saved_at,
  };
}

export async function ecrireClub(base: Base, c: LocalClub): Promise<void> {
  await base.executer(
    "INSERT OR REPLACE INTO clubs (id, slug, name, color_a, color_b, track_assists, " +
      "track_cards, motm_mode, match_duration_min, saved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      c.id,
      c.slug,
      c.name,
      c.colorA,
      c.colorB,
      b(c.trackAssists),
      b(c.trackCards),
      c.motmMode,
      c.matchDurationMin,
      c.savedAt,
    ],
  );
}

export async function lireClub(
  base: Base,
  id: string,
): Promise<LocalClub | undefined> {
  const l = await base.premier<LigneClub>("SELECT * FROM clubs WHERE id = ?", [id]);
  return l ? versClub(l) : undefined;
}

/// Le club par son slug. Dexie prenait `.where("slug").equals(...).first()` ;
/// l'index `clubs_slug` est là pour la même raison.
export async function lireClubParSlug(
  base: Base,
  slug: string,
): Promise<LocalClub | undefined> {
  const l = await base.premier<LigneClub>(
    "SELECT * FROM clubs WHERE slug = ? ORDER BY id ASC LIMIT 1",
    [slug],
  );
  return l ? versClub(l) : undefined;
}

// --- roster -----------------------------------------------------------------

type LigneJoueur = {
  id: string;
  club_id: string;
  name: string;
  nickname: string | null;
  photo: string | null;
  skill: number;
  is_gk: number;
  is_guest: number;
  is_archived: number;
};

function versJoueur(l: LigneJoueur): LocalPlayer {
  return {
    id: l.id,
    clubId: l.club_id,
    name: l.name,
    nickname: l.nickname,
    photo: l.photo,
    skill: l.skill,
    isGk: versBooleen(l.is_gk),
    isGuest: versBooleen(l.is_guest),
    isArchived: versBooleen(l.is_archived),
  };
}

/// Remplace la fiche entière — le `put` de Dexie, pas un `update`.
export async function ecrireJoueur(base: Base, p: LocalPlayer): Promise<void> {
  await base.executer(
    "INSERT OR REPLACE INTO roster (id, club_id, name, nickname, photo, skill, " +
      "is_gk, is_guest, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      p.id,
      p.clubId,
      p.name,
      p.nickname ?? null,
      p.photo ?? null,
      p.skill,
      b(p.isGk),
      b(p.isGuest),
      b(p.isArchived),
    ],
  );
}

export async function lireJoueur(
  base: Base,
  id: string,
): Promise<LocalPlayer | undefined> {
  const l = await base.premier<LigneJoueur>("SELECT * FROM roster WHERE id = ?", [
    id,
  ]);
  return l ? versJoueur(l) : undefined;
}

/// Le `bulkGet` de Dexie : plusieurs fiches d'un coup, indexées par
/// identifiant. Rendre une Map plutôt qu'un tableau parallèle évite l'erreur
/// de décalage quand une fiche manque — Dexie y mettait `undefined`, et le
/// `roster.filter(Boolean)` du web existe pour ça.
export async function lireJoueurs(
  base: Base,
  ids: string[],
): Promise<Map<string, LocalPlayer>> {
  if (ids.length === 0) return new Map();
  const trous = ids.map(() => "?").join(", ");
  const lignes = await base.lire<LigneJoueur>(
    `SELECT * FROM roster WHERE id IN (${trous})`,
    ids,
  );
  return new Map(lignes.map((l) => [l.id, versJoueur(l)]));
}

/// Tout le vivier d'un club, archivés compris — le tri et le filtre se font
/// au-dessus, comme dans la version Dexie.
export async function lireVivier(
  base: Base,
  clubId: string,
): Promise<LocalPlayer[]> {
  const lignes = await base.lire<LigneJoueur>(
    "SELECT * FROM roster WHERE club_id = ?",
    [clubId],
  );
  return lignes.map(versJoueur);
}

// --- matches ----------------------------------------------------------------

type LigneMatch = {
  id: string;
  club_id: string;
  match_day_id: string | null;
  season_id: string | null;
  kind: LocalMatch["kind"];
  opponent_id: string | null;
  played_at: string;
  team_a_name: string;
  team_b_name: string;
  score_a: number;
  score_b: number;
  status: LocalMatch["status"];
  mvp_id: string | null;
  clock_elapsed_ms: number;
  clock_running_since: string | null;
  period: number;
};

function versMatch(l: LigneMatch): LocalMatch {
  return {
    id: l.id,
    clubId: l.club_id,
    matchDayId: l.match_day_id,
    seasonId: l.season_id,
    kind: l.kind,
    opponentId: l.opponent_id,
    playedAt: l.played_at,
    teamAName: l.team_a_name,
    teamBName: l.team_b_name,
    scoreA: l.score_a,
    scoreB: l.score_b,
    status: l.status,
    mvpId: l.mvp_id,
    clockElapsedMs: l.clock_elapsed_ms,
    clockRunningSince: l.clock_running_since,
    period: l.period,
  };
}

/// Remplace la feuille entière. Les trois colonnes du chrono retombent à leur
/// défaut (`0`, `NULL`, `1`) quand l'objet ne les porte pas — c'est ce que
/// faisait le `put` de Dexie, et c'est pour ça que la reprise du chrono se
/// fait par `majChrono` et jamais par une réécriture du match.
export async function ecrireMatch(base: Base, m: LocalMatch): Promise<void> {
  await base.executer(
    "INSERT OR REPLACE INTO matches (id, club_id, match_day_id, season_id, kind, " +
      "opponent_id, played_at, team_a_name, team_b_name, score_a, score_b, status, " +
      "mvp_id, clock_elapsed_ms, clock_running_since, period) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      m.id,
      m.clubId,
      m.matchDayId ?? null,
      m.seasonId ?? null,
      m.kind,
      m.opponentId ?? null,
      m.playedAt,
      m.teamAName,
      m.teamBName,
      m.scoreA,
      m.scoreB,
      m.status,
      m.mvpId,
      m.clockElapsedMs ?? 0,
      m.clockRunningSince ?? null,
      m.period ?? 1,
    ],
  );
}

export async function lireMatch(
  base: Base,
  id: string,
): Promise<LocalMatch | undefined> {
  const l = await base.premier<LigneMatch>("SELECT * FROM matches WHERE id = ?", [
    id,
  ]);
  return l ? versMatch(l) : undefined;
}

/// Le match en cours d'un club, le plus récent d'abord. Dexie interrogeait
/// l'index composé `[clubId+status]` puis triait en mémoire sur `playedAt`
/// décroissant ; l'index `matches_club_statut` sert le même plan.
export async function lireMatchEnCours(
  base: Base,
  clubId: string,
): Promise<LocalMatch | undefined> {
  const l = await base.premier<LigneMatch>(
    "SELECT * FROM matches WHERE club_id = ? AND status = 'LIVE' " +
      "ORDER BY played_at DESC, id ASC LIMIT 1",
    [clubId],
  );
  return l ? versMatch(l) : undefined;
}

export async function majScore(
  base: Base,
  matchId: string,
  scoreA: number,
  scoreB: number,
): Promise<void> {
  await base.executer("UPDATE matches SET score_a = ?, score_b = ? WHERE id = ?", [
    scoreA,
    scoreB,
    matchId,
  ]);
}

/// Écrit l'état du chrono. Purement local : le serveur ne connaît pas le
/// chrono, il ne reçoit que la durée au coup de sifflet final. Rien à enfiler
/// dans la file, donc — et c'est pour ça que cette fonction ne passe pas par
/// une opération d'outbox comme toutes les autres écritures.
export async function majHorloge(
  base: Base,
  matchId: string,
  elapsedMs: number,
  runningSince: string | null,
): Promise<void> {
  await base.executer(
    "UPDATE matches SET clock_elapsed_ms = ?, clock_running_since = ? WHERE id = ?",
    [elapsedMs, runningSince, matchId],
  );
}

export async function majPeriode(
  base: Base,
  matchId: string,
  period: number,
): Promise<void> {
  await base.executer("UPDATE matches SET period = ? WHERE id = ?", [period, matchId]);
}

export async function majFinDeMatch(
  base: Base,
  matchId: string,
  mvpId: string | null,
): Promise<void> {
  await base.executer(
    "UPDATE matches SET status = 'FINISHED', mvp_id = ? WHERE id = ?",
    [mvpId, matchId],
  );
}

// --- participants -----------------------------------------------------------

type LigneParticipant = {
  key: string;
  match_id: string;
  player_id: string;
  team: "A" | "B";
  is_gk: number;
};

function versParticipant(l: LigneParticipant): LocalParticipant {
  return {
    key: l.key,
    matchId: l.match_id,
    playerId: l.player_id,
    team: l.team,
    isGk: versBooleen(l.is_gk),
  };
}

export async function ecrireParticipant(
  base: Base,
  p: LocalParticipant,
): Promise<void> {
  await base.executer(
    "INSERT OR REPLACE INTO participants (key, match_id, player_id, team, is_gk) " +
      "VALUES (?, ?, ?, ?, ?)",
    [p.key, p.matchId, p.playerId, p.team, b(p.isGk)],
  );
}

export async function lireParticipant(
  base: Base,
  key: string,
): Promise<LocalParticipant | undefined> {
  const l = await base.premier<LigneParticipant>(
    "SELECT * FROM participants WHERE key = ?",
    [key],
  );
  return l ? versParticipant(l) : undefined;
}

export async function lireParticipants(
  base: Base,
  matchId: string,
): Promise<LocalParticipant[]> {
  const lignes = await base.lire<LigneParticipant>(
    "SELECT * FROM participants WHERE match_id = ? ORDER BY key ASC",
    [matchId],
  );
  return lignes.map(versParticipant);
}

/// Combien de joueurs resteraient dans ce camp si `playerId` en sortait.
/// C'est le garde anti-équipe-vide, et il compte en base plutôt qu'en mémoire :
/// la transaction est exclusive, le compte est donc juste au moment où il sert.
export async function compterCoequipiers(
  base: Base,
  matchId: string,
  team: "A" | "B",
  saufPlayerId: string,
): Promise<number> {
  const l = await base.premier<{ n: number }>(
    "SELECT COUNT(*) AS n FROM participants WHERE match_id = ? AND team = ? AND player_id <> ?",
    [matchId, team, saufPlayerId],
  );
  return l?.n ?? 0;
}

export async function majEquipe(
  base: Base,
  key: string,
  team: "A" | "B",
): Promise<void> {
  await base.executer("UPDATE participants SET team = ? WHERE key = ?", [team, key]);
}

// --- events -----------------------------------------------------------------

type LigneEvenement = {
  id: string;
  match_id: string;
  type: LocalEvent["type"];
  team: "A" | "B";
  player_id: string | null;
  assist_player_id: string | null;
  minute: number | null;
  created_at: string;
};

function versEvenement(l: LigneEvenement): LocalEvent {
  return {
    id: l.id,
    matchId: l.match_id,
    type: l.type,
    team: l.team,
    playerId: l.player_id,
    assistPlayerId: l.assist_player_id,
    minute: l.minute,
    createdAt: l.created_at,
  };
}

export async function ecrireEvenement(base: Base, e: LocalEvent): Promise<void> {
  await base.executer(
    "INSERT OR REPLACE INTO events (id, match_id, type, team, player_id, " +
      "assist_player_id, minute, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      e.id,
      e.matchId,
      e.type,
      e.team,
      e.playerId ?? null,
      e.assistPlayerId ?? null,
      e.minute ?? null,
      e.createdAt,
    ],
  );
}

export async function lireEvenement(
  base: Base,
  id: string,
): Promise<LocalEvent | undefined> {
  const l = await base.premier<LigneEvenement>("SELECT * FROM events WHERE id = ?", [
    id,
  ]);
  return l ? versEvenement(l) : undefined;
}

/// Les événements d'un match, du premier au dernier.
///
/// `created_at ASC, id ASC` : Dexie lisait l'index `[matchId+createdAt]` puis
/// appelait `sortBy("createdAt")`, un tri stable — à horodatage égal, l'ordre
/// restait celui de la clé primaire. Le second critère reproduit ce
/// départage plutôt que de le laisser au hasard du plan de requête.
export async function lireEvenements(
  base: Base,
  matchId: string,
): Promise<LocalEvent[]> {
  const lignes = await base.lire<LigneEvenement>(
    "SELECT * FROM events WHERE match_id = ? ORDER BY created_at ASC, id ASC",
    [matchId],
  );
  return lignes.map(versEvenement);
}

/// Le dernier but d'un joueur dans ce match — la cible du geste « − » sur sa
/// tuile. L'ordre est l'exact inverse de `lireEvenements` : le `.last()` de
/// Dexie sur le même index.
export async function lireDernierBut(
  base: Base,
  matchId: string,
  playerId: string,
): Promise<LocalEvent | undefined> {
  const l = await base.premier<LigneEvenement>(
    "SELECT * FROM events WHERE match_id = ? AND player_id = ? AND type = 'GOAL' " +
      "ORDER BY created_at DESC, id DESC LIMIT 1",
    [matchId, playerId],
  );
  return l ? versEvenement(l) : undefined;
}

export async function supprimerEvenement(base: Base, id: string): Promise<void> {
  await base.executer("DELETE FROM events WHERE id = ?", [id]);
}

export async function majPasseur(
  base: Base,
  eventId: string,
  assistPlayerId: string | null,
): Promise<void> {
  await base.executer("UPDATE events SET assist_player_id = ? WHERE id = ?", [
    assistPlayerId,
    eventId,
  ]);
}

export async function majButeur(
  base: Base,
  eventId: string,
  playerId: string | null,
): Promise<void> {
  await base.executer("UPDATE events SET player_id = ? WHERE id = ?", [
    playerId,
    eventId,
  ]);
}

// --- outbox, côté lecture ---------------------------------------------------

/// Combien d'opérations restent à envoyer pour ce match. Zéro = le serveur
/// sait tout, on peut lui faire confiance pour le récap complet.
///
/// Compte les bloquées AUSSI, comme le faisait le `filter().count()` de Dexie :
/// une opération refusée n'est pas partie, et l'écran ne doit pas dire le
/// contraire. La distinction entre attente et refus se lit dans `compteurs()`
/// de « lib/outbox/outbox.ts », qui est faite pour ça.
export async function compterOpsDuMatch(
  base: Base,
  matchId: string,
): Promise<number> {
  const l = await base.premier<{ n: number }>(
    "SELECT COUNT(*) AS n FROM outbox WHERE match_id = ?",
    [matchId],
  );
  return l?.n ?? 0;
}
