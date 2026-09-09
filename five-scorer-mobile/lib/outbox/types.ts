// Le modèle local, tel qu'il est écrit côté web.
//
// « five-scorer/lib/db.ts » déclare les six formes du miroir hors-ligne
// (LocalPlayer, LocalMatch, LocalParticipant, LocalEvent, LocalClub) et,
// surtout, l'union fermée « OutboxOp » : les huit mutations que le drain
// rejoue contre le serveur. Ces types ne dépendent de rien — ni de Dexie, ni
// du navigateur — mais le fichier d'origine, lui, importe Dexie dès sa
// septième ligne. Il ne peut donc pas être copié en entier comme les six
// fichiers de « lib/noyau/ ».
//
// On en copie donc la TRANCHE utile, octet pour octet : les lignes 9 à 196,
// c'est-à-dire tout ce qui suit l'import de Dexie et tout ce qui précède la
// classe « FiveScorerDB ». « types.test.ts » relit la tranche à la source et
// échoue si elle a bougé — c'est le même filet que « copie-conforme.test.ts »
// pose sur le noyau, pour la même raison : deux exemplaires d'une même règle
// divergent toujours, et on veut l'apprendre par un test rouge plutôt que par
// un but perdu au bord du terrain.
//
// NE PAS ÉDITER sous le marqueur. La correction s'écrit dans
// « five-scorer/lib/db.ts », puis se recopie ici.

// ——— COPIE CONFORME : five-scorer/lib/db.ts, lignes 9 à 196 ———
export type LocalPlayer = {
  id: string;
  clubId: string;
  name: string;
  nickname?: string | null;
  /// La photo, mise en cache comme le reste : la feuille de match doit
  /// montrer les visages même sans réseau, au bord du terrain.
  photo?: string | null;
  skill: number;
  isGk: boolean;
  isGuest: boolean;
  /// Le cache local ne se purge jamais : un joueur archivé après coup restait
  /// proposé à l'entrée en cours de match, et rentrait dans les statistiques.
  isArchived?: boolean;
};

export type LocalMatch = {
  id: string;
  clubId: string;
  matchDayId?: string | null;
  seasonId?: string | null;
  kind: "INTERNAL" | "EXTERNAL";
  opponentId?: string | null;
  playedAt: string; // ISO
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
  status: "LIVE" | "FINISHED";
  mvpId: string | null;
  /// État du chrono, persisté pour survivre aux reloads/changements d'onglet.
  /// elapsedMs = temps de jeu cumulé hors pauses au moment de pausedAt (ou du
  /// dernier resume) ; runningSince = timestamp du dernier départ (null si en
  /// pause) ; period = période courante (1 puis 2 après la mi-temps).
  clockElapsedMs?: number;
  clockRunningSince?: string | null; // ISO
  period?: number;
};

export type LocalParticipant = {
  // clé primaire composée "matchId::playerId"
  key: string;
  matchId: string;
  playerId: string;
  team: "A" | "B";
  isGk: boolean;
};

export type LocalEventType =
  | "GOAL"
  | "OWN_GOAL"
  | "YELLOW_CARD"
  | "RED_CARD"
  | "HALF_TIME";

export type LocalEvent = {
  id: string;
  matchId: string;
  type: LocalEventType;
  /// Équipe créditée (pour un but, celle qui marque — y compris sur csc).
  team: "A" | "B";
  playerId: string | null;
  assistPlayerId?: string | null;
  minute: number | null;
  createdAt: string; // ISO
};

// --- Outbox ----------------------------------------------------------------
//
// Journal append-only des mutations locales à rejouer contre le serveur.
// FIFO, idempotent côté serveur grâce aux IDs générés client.

export type OutboxOp =
  | {
      kind: "createMatch";
      clubId: string;
      matchId: string;
      payload: {
        id: string;
        playedAt: string;
        matchDayId?: string | null;
        seasonId?: string | null;
        matchKind: "INTERNAL" | "EXTERNAL";
        opponentId?: string | null;
        teamAName: string;
        teamBName: string;
        teamA: { playerId: string; isGk: boolean }[];
        teamB: { playerId: string; isGk: boolean }[];
        /// Invités créés hors-ligne, upsert côté serveur avant les compos.
        guests: { id: string; name: string }[];
      };
    }
  | {
      kind: "addEvent";
      clubId: string;
      matchId: string;
      payload: {
        id: string;
        type: LocalEventType;
        team: "A" | "B";
        playerId: string | null;
        assistPlayerId?: string | null;
        minute: number | null;
        createdAt: string;
      };
    }
  | {
      kind: "removeEvent";
      clubId: string;
      matchId: string;
      payload: { eventId: string };
    }
  | {
      kind: "setAssist";
      clubId: string;
      matchId: string;
      payload: { eventId: string; assistPlayerId: string | null };
    }
  | {
      /// Désigne (ou retire) l'auteur d'un contre son camp déjà saisi. Le but
      /// part au premier tap avec un buteur nul ; le nom se choisit après, sans
      /// bloquer le score.
      kind: "setScorer";
      clubId: string;
      matchId: string;
      payload: { eventId: string; scorerPlayerId: string | null };
    }
  | {
      /// Inscrit un joueur arrivé après le coup d'envoi. Sans elle, la saisie
      /// de ses buts était refusée (« Joueur non inscrit à ce match ») et la
      /// seule issue était de terminer le match et de tout ressaisir.
      kind: "addParticipant";
      clubId: string;
      matchId: string;
      payload: {
        playerId: string;
        team: "A" | "B";
        isGk: boolean;
        /// Un invité créé hors ligne n'existe pas encore côté serveur. Sans
        /// lui, la route répondait 400 « Joueur hors du club » — un refus, donc
        /// le blocage DÉFINITIF de toute la chaîne d'ops du match, buts
        /// compris. createMatch embarque déjà ses invités de la même façon.
        guest?: { id: string; name: string };
      };
    }
  | {
      /// Corrige la composition d'un match en cours : un joueur change de camp.
      /// Rejouable — le serveur écrit l'appartenance voulue, pas un delta.
      kind: "movePlayer";
      clubId: string;
      matchId: string;
      payload: { playerId: string; team: "A" | "B" };
    }
  | {
      kind: "finishMatch";
      clubId: string;
      matchId: string;
      payload: { mvpId: string | null; durationMin?: number | null };
    };

/// Le club tel que la coquille de match hors-ligne en a besoin : réglages de
/// saisie, noms et couleurs des chasubles, slug pour les liens. Rempli à
/// chaque visite EN LIGNE d'une page du club — c'est la seule façon de rendre
/// l'écran de match sans serveur.
export type LocalClub = {
  id: string;
  slug: string;
  name: string;
  colorA: string | null;
  colorB: string | null;
  trackAssists: boolean;
  trackCards: boolean;
  motmMode: "VOTE" | "ADMIN" | "OFF";
  matchDurationMin: number;
  savedAt: string;
};

export type OutboxEntry = {
  id?: number; // auto-incrément
  createdAt: string; // ISO
  attempts: number;
  lastError?: string | null;
  /// Refusée par le serveur (403, 404, 409…). L'opération sort de la file
  /// active mais reste conservée : on ne détruit pas la saisie d'un match sans
  /// le dire. Absent tant que l'opération est en attente normale.
  blockedAt?: string | null;
  op: OutboxOp;
};
