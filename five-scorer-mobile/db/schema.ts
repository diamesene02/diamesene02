// GÉNÉRÉ — ne pas éditer à la main.
//
// Copie conforme de `db/schema.sql`, qui est la seule source du schéma.
// Régénérer avec : node scripts/schema-vers-ts.mjs
// L'égalité octet pour octet est vérifiée par `db/schema.test.ts`.

export const SCHEMA = `-- Le miroir local de l'état serveur, en SQLite.
--
-- Traduction des 6 tables de « five-scorer/lib/db.ts » (Dexie v3) : roster,
-- matches, participants, events, outbox, clubs. Même modèle, même sémantique ;
-- seule la mécanique change, IndexedDB n'existant pas en React Native.
--
-- Trois règles ont guidé l'écriture, et elles se relisent dans le fichier :
--
--   1. « outbox.id » est un INTEGER PRIMARY KEY **AUTOINCREMENT**. Sans le mot,
--      SQLite recycle l'identifiant le plus haut libéré : supprimer la ligne 3
--      puis insérer redonne 3, et une opération neuve prend la place d'une
--      opération déjà partie. L'ordre de rejeu se prend sur cette clé, jamais
--      sur l'horodatage — l'horloge du téléphone peut reculer (le commentaire
--      de « lib/sync.ts » raconte ce bug). « db/schema.test.ts » le prouve.
--   2. Les colonnes sont en « serpent_minuscule », les champs TypeScript en
--      « casseChameau ». La conversion vit dans la couche d'accès (étape 7), à
--      un seul endroit.
--   3. **Aucune clé étrangère.** Dexie n'en avait pas, et « lib/localMatch.ts »
--      s'appuie sur ce fait : un événement peut être écrit dans la même
--      transaction que son match sans contrainte d'ordre, et le cache local
--      n'est jamais « incohérent », seulement en retard. Ajouter des FK ici
--      changerait le comportement porté au lieu de le reproduire.
--
-- Les CHECK, eux, sont une addition assumée : ils rejouent en base les unions
-- fermées de « lib/db.ts » (« "A" | "B" », « "LIVE" | "FINISHED" », …). Le typage
-- TypeScript s'arrête à la frontière de la base ; ces contraintes attrapent la
-- faute de portage à l'écriture plutôt qu'au bord du terrain.
--
-- Ce fichier est la SEULE source du schéma. « db/schema.ts » en est une copie
-- conforme, vérifiée octet pour octet par « db/schema.test.ts » : Metro ne sait
-- pas charger un « .sql » sans plugin Babel, l'app lit donc la copie TypeScript.

-- WAL : un lecteur ne bloque plus un écrivain. Pendant un match, l'écran lit
-- pendant que l'outbox se vide — c'est exactement le cas d'usage.
PRAGMA journal_mode = WAL;
-- NORMAL suffit avec WAL et supprime un fsync par transaction : sur un but,
-- deux tables écrites, deux fois moins d'attente disque.
PRAGMA synchronous = NORMAL;

-- --------------------------------------------------------------------------
-- clubs — les réglages du club, pour que l'écran de match se rende sans
-- serveur. Rempli à chaque visite EN LIGNE (LocalClub).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clubs (
  id                 TEXT PRIMARY KEY,
  slug               TEXT NOT NULL,
  name               TEXT NOT NULL,
  color_a            TEXT,
  color_b            TEXT,
  track_assists      INTEGER NOT NULL CHECK (track_assists IN (0, 1)),
  track_cards        INTEGER NOT NULL CHECK (track_cards IN (0, 1)),
  motm_mode          TEXT NOT NULL CHECK (motm_mode IN ('VOTE', 'ADMIN', 'OFF')),
  match_duration_min INTEGER NOT NULL,
  saved_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS clubs_slug ON clubs (slug);

-- --------------------------------------------------------------------------
-- roster — l'effectif mis en cache, photos comprises : la feuille de match
-- doit montrer les visages sans réseau (LocalPlayer).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roster (
  id          TEXT PRIMARY KEY,
  club_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  nickname    TEXT,
  -- Data-URL JPEG d'environ 20 ko. À ne PAS remonter dans la requête branchée
  -- sur l'affichage du match : quatorze joueurs, c'est ~280 ko rematérialisés
  -- à chaque but (§3.3 de MOBILE.md, mesure encore à faire).
  photo       TEXT,
  skill       INTEGER NOT NULL,
  is_gk       INTEGER NOT NULL CHECK (is_gk IN (0, 1)),
  is_guest    INTEGER NOT NULL CHECK (is_guest IN (0, 1)),
  -- Optionnel côté TypeScript, jamais nul ici : un joueur archivé après coup
  -- restait proposé à l'entrée en cours de match et rentrait dans les stats.
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1))
);
CREATE INDEX IF NOT EXISTS roster_club ON roster (club_id);
CREATE INDEX IF NOT EXISTS roster_club_invite ON roster (club_id, is_guest);

-- --------------------------------------------------------------------------
-- matches — la feuille de match, chrono compris (LocalMatch).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
  id                  TEXT PRIMARY KEY,
  club_id             TEXT NOT NULL,
  match_day_id        TEXT,
  season_id           TEXT,
  kind                TEXT NOT NULL CHECK (kind IN ('INTERNAL', 'EXTERNAL')),
  opponent_id         TEXT,
  played_at           TEXT NOT NULL,
  team_a_name         TEXT NOT NULL,
  team_b_name         TEXT NOT NULL,
  score_a             INTEGER NOT NULL DEFAULT 0,
  score_b             INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL CHECK (status IN ('LIVE', 'FINISHED')),
  mvp_id              TEXT,
  -- Le chrono se DÉRIVE de ces trois colonnes (lib/noyau/clock.ts), il ne se
  -- ticke pas : la suspension des timers par iOS ne peut donc pas le décaler.
  -- elapsed_ms = jeu cumulé hors pauses ; running_since = départ du segment
  -- courant, NULL en pause ; period = 1 puis 2 après la mi-temps.
  clock_elapsed_ms    INTEGER NOT NULL DEFAULT 0,
  clock_running_since TEXT,
  period              INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS matches_club ON matches (club_id);
CREATE INDEX IF NOT EXISTS matches_club_statut ON matches (club_id, status);
CREATE INDEX IF NOT EXISTS matches_joue_le ON matches (played_at);

-- --------------------------------------------------------------------------
-- participants — qui joue, dans quel camp (LocalParticipant).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS participants (
  -- Clé composée "matchId::playerId", telle quelle depuis Dexie.
  key       TEXT PRIMARY KEY,
  match_id  TEXT NOT NULL,
  player_id TEXT NOT NULL,
  team      TEXT NOT NULL CHECK (team IN ('A', 'B')),
  is_gk     INTEGER NOT NULL CHECK (is_gk IN (0, 1)),
  -- La même paire ne peut pas entrer deux fois sous deux clés mal formées.
  UNIQUE (match_id, player_id)
);
CREATE INDEX IF NOT EXISTS participants_match ON participants (match_id);
CREATE INDEX IF NOT EXISTS participants_joueur ON participants (player_id);

-- --------------------------------------------------------------------------
-- events — buts, csc, cartons, mi-temps (LocalEvent). « team » est l'équipe
-- CRÉDITÉE, y compris sur un contre son camp.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id               TEXT PRIMARY KEY,
  match_id         TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (
                     type IN ('GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'RED_CARD', 'HALF_TIME')
                   ),
  team             TEXT NOT NULL CHECK (team IN ('A', 'B')),
  -- Nul assumé : le but part au premier tap, le nom du buteur se choisit
  -- après, sans bloquer le score.
  player_id        TEXT,
  assist_player_id TEXT,
  minute           INTEGER,
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_match ON events (match_id);
CREATE INDEX IF NOT EXISTS events_cree_le ON events (created_at);
CREATE INDEX IF NOT EXISTS events_match_cree_le ON events (match_id, created_at);

-- --------------------------------------------------------------------------
-- outbox — journal append-only des mutations à rejouer contre le serveur.
-- FIFO sur « id », idempotent côté serveur grâce aux identifiants cuid2 générés
-- ici (lib/noyau/ids.ts).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outbox (
  -- AUTOINCREMENT : obligatoire, pas décoratif. Voir l'entête et le test.
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  -- Refusée par le serveur (403, 404, 409…). L'opération sort de la file
  -- active mais reste conservée : on ne détruit pas la saisie d'un match sans
  -- le dire. NULL tant qu'elle est en attente normale.
  blocked_at TEXT,
  -- Extrait du JSON et monté en colonne : c'est par lui que le refus d'une
  -- opération bloque en cascade toutes celles du même match.
  match_id   TEXT,
  club_id    TEXT NOT NULL,
  -- L'OutboxOp sérialisé, inchangé.
  op         TEXT NOT NULL
);
-- L'index du drain : « la prochaine opération active », dans l'ordre.
CREATE INDEX IF NOT EXISTS outbox_actives ON outbox (blocked_at, id);
-- Le blocage en cascade cherche par match parmi les actives.
CREATE INDEX IF NOT EXISTS outbox_match ON outbox (match_id, blocked_at);
`;
