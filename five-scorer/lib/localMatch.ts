// Actions local-first d'un match. Chaque mutation :
//   1. met à jour Dexie (l'UI re-render immédiatement)
//   2. ajoute une OutboxEntry que le sync worker rejouera
//
// Ces fonctions ne touchent JAMAIS le réseau — c'est le job du sync worker
// (lib/sync.ts). La saisie live reste instantanée et offline-safe.

import Dexie from "dexie";
import {
  getDb,
  type LocalClub,
  type LocalEvent,
  type LocalEventType,
  type LocalMatch,
  type OutboxOp,
} from "./db";
import { newId } from "./ids";
import { RETRO_APRES_MS } from "./retro";

function pKey(matchId: string, playerId: string) {
  return `${matchId}::${playerId}`;
}

async function enqueue(op: OutboxOp) {
  const db = getDb();
  await db.outbox.add({
    createdAt: new Date().toISOString(),
    attempts: 0,
    op,
  });
}

// --- Cache roster ----------------------------------------------------------

export async function saveRoster(
  clubId: string,
  players: {
    id: string;
    name: string;
    nickname?: string | null;
    skill: number;
    isGk: boolean;
    isGuest: boolean;
    isArchived?: boolean;
  }[],
) {
  const db = getDb();
  await db.roster.bulkPut(
    players.map((p) => ({ ...p, clubId, isArchived: Boolean(p.isArchived) })),
  );
}

export async function addLocalGuest(
  clubId: string,
  name: string,
): Promise<string> {
  const id = newId();
  const db = getDb();
  await db.roster.put({
    id,
    clubId,
    name,
    nickname: null,
    skill: 3,
    isGk: false,
    isGuest: true,
  });
  return id;
}

// --- Cache du club ---------------------------------------------------------

/// Enregistre les réglages du club à chaque visite en ligne. C'est ce qui
/// permet à la coquille de match de se rendre hors-ligne, pour un match créé
/// hors-ligne, sans jamais toucher au serveur.
export async function saveClubSettings(
  club: Omit<LocalClub, "savedAt">,
): Promise<void> {
  const db = getDb();
  await db.clubs.put({ ...club, savedAt: new Date().toISOString() });
}

export async function getLocalClub(clubId: string): Promise<LocalClub | undefined> {
  return getDb().clubs.get(clubId);
}

export async function getLocalClubBySlug(
  slug: string,
): Promise<LocalClub | undefined> {
  return getDb().clubs.where("slug").equals(slug).first();
}

/// Le match en cours du club, s'il y en a un dans la mémoire locale. C'est
/// LE chemin de reprise du lundi soir : l'onglet tué, l'app rouverte, le
/// match retrouvé — sans serveur.
export async function getLiveMatchOfClub(
  clubId: string,
): Promise<LocalMatch | undefined> {
  const db = getDb();
  const live = await db.matches
    .where("[clubId+status]")
    .equals([clubId, "LIVE"])
    .toArray();
  live.sort((a, b) => (a.playedAt < b.playedAt ? 1 : -1));
  return live[0];
}

/// Nombre d'opérations encore à envoyer pour un match. Zéro = le serveur sait
/// tout, on peut lui faire confiance pour le récap complet.
export async function pendingOpsForMatch(matchId: string): Promise<number> {
  const db = getDb();
  return db.outbox.filter((o) => o.op.matchId === matchId).count();
}

// --- Cycle de vie du match -------------------------------------------------

export type CreateMatchInput = {
  clubId: string;
  matchDayId?: string | null;
  seasonId?: string | null;
  kind: "INTERNAL" | "EXTERNAL";
  opponentId?: string | null;
  teamAName: string;
  teamBName: string;
  teamA: { playerId: string; isGk: boolean }[];
  teamB: { playerId: string; isGk: boolean }[];
  /// Quand le match a été joué (ISO). Absent = maintenant. Une date passée
  /// crée une feuille rétro : pas d'horloge, pas de minutes (cf. lib/retro).
  playedAt?: string | null;
};

export async function createMatch(input: CreateMatchInput): Promise<string> {
  const db = getDb();
  const id = newId();
  const playedAt = input.playedAt ?? new Date().toISOString();

  await db.transaction(
    "rw",
    db.matches,
    db.participants,
    db.roster,
    db.outbox,
    async () => {
      await db.matches.put({
        id,
        clubId: input.clubId,
        matchDayId: input.matchDayId ?? null,
        seasonId: input.seasonId ?? null,
        kind: input.kind,
        opponentId: input.opponentId ?? null,
        playedAt,
        teamAName: input.teamAName,
        teamBName: input.teamBName,
        scoreA: 0,
        scoreB: 0,
        status: "LIVE",
        mvpId: null,
      });

      const parts = [
        ...input.teamA.map((p) => ({
          key: pKey(id, p.playerId),
          matchId: id,
          playerId: p.playerId,
          team: "A" as const,
          isGk: p.isGk,
        })),
        ...input.teamB.map((p) => ({
          key: pKey(id, p.playerId),
          matchId: id,
          playerId: p.playerId,
          team: "B" as const,
          isGk: p.isGk,
        })),
      ];
      await db.participants.bulkPut(parts);

      // Les invités créés hors-ligne doivent exister côté serveur avant les
      // compos — on les embarque dans le payload de création.
      const ids = parts.map((p) => p.playerId);
      const roster = await db.roster.bulkGet(ids);
      const guests = roster
        .filter((p): p is NonNullable<typeof p> => Boolean(p?.isGuest))
        .map((p) => ({ id: p.id, name: p.name }));

      await enqueue({
        kind: "createMatch",
        clubId: input.clubId,
        matchId: id,
        payload: {
          id,
          playedAt,
          matchDayId: input.matchDayId ?? null,
          seasonId: input.seasonId ?? null,
          matchKind: input.kind,
          opponentId: input.opponentId ?? null,
          teamAName: input.teamAName,
          teamBName: input.teamBName,
          teamA: input.teamA,
          teamB: input.teamB,
          guests,
        },
      });
    },
  );

  return id;
}

function scoreDelta(type: LocalEventType): number {
  return type === "GOAL" || type === "OWN_GOAL" ? 1 : 0;
}

/// Démarre en local un match programmé côté serveur : on seed Dexie avec le
/// MÊME id puis on enfile l'op createMatch — l'API est un upsert idempotent
/// qui bascule le match SCHEDULED → LIVE. Le live fonctionne ensuite
/// exactement comme un match créé sur l'appareil.
export type ScheduledMatchSeed = {
  id: string;
  clubId: string;
  matchDayId?: string | null;
  seasonId?: string | null;
  kind: "INTERNAL" | "EXTERNAL";
  opponentId?: string | null;
  teamAName: string;
  teamBName: string;
  teamA: { playerId: string; isGk: boolean }[];
  teamB: { playerId: string; isGk: boolean }[];
};

export async function launchScheduledMatch(
  seed: ScheduledMatchSeed,
): Promise<string> {
  const db = getDb();
  const playedAt = new Date().toISOString();

  await db.transaction(
    "rw",
    db.matches,
    db.participants,
    db.roster,
    db.outbox,
    async () => {
      const existing = await db.matches.get(seed.id);
      if (existing) return; // déjà lancé sur cet appareil

      await db.matches.put({
        id: seed.id,
        clubId: seed.clubId,
        matchDayId: seed.matchDayId ?? null,
        seasonId: seed.seasonId ?? null,
        kind: seed.kind,
        opponentId: seed.opponentId ?? null,
        playedAt,
        teamAName: seed.teamAName,
        teamBName: seed.teamBName,
        scoreA: 0,
        scoreB: 0,
        status: "LIVE",
        mvpId: null,
      });
      await db.participants.bulkPut(
        [
          ...seed.teamA.map((p) => ({ team: "A" as const, ...p })),
          ...seed.teamB.map((p) => ({ team: "B" as const, ...p })),
        ].map((p) => ({
          key: pKey(seed.id, p.playerId),
          matchId: seed.id,
          playerId: p.playerId,
          team: p.team,
          isGk: p.isGk,
        })),
      );
      await enqueue({
        kind: "createMatch",
        clubId: seed.clubId,
        matchId: seed.id,
        payload: {
          id: seed.id,
          playedAt,
          matchDayId: seed.matchDayId ?? null,
          seasonId: seed.seasonId ?? null,
          matchKind: seed.kind,
          opponentId: seed.opponentId ?? null,
          teamAName: seed.teamAName,
          teamBName: seed.teamBName,
          teamA: seed.teamA,
          teamB: seed.teamB,
          guests: [],
        },
      });
    },
  );
  return seed.id;
}

export type AddEventInput = {
  type: LocalEventType;
  /// Équipe créditée. Pour un GOAL d'un joueur, l'équipe du joueur ; pour un
  /// OWN_GOAL, l'équipe adverse (celle qui en profite).
  team: "A" | "B";
  playerId?: string | null;
  assistPlayerId?: string | null;
  minute?: number | null;
};

export async function addEvent(
  matchId: string,
  input: AddEventInput,
): Promise<string> {
  const db = getDb();
  const eventId = newId();
  const createdAt = new Date().toISOString();

  await db.transaction(
    "rw",
    db.matches,
    db.participants,
    db.events,
    db.outbox,
    async () => {
      const match = await db.matches.get(matchId);
      if (!match) throw new Error("Match introuvable");
      if (match.status === "FINISHED") throw new Error("Match terminé");

      if (input.playerId) {
        const part = await db.participants.get(pKey(matchId, input.playerId));
        if (!part && match.kind === "INTERNAL") {
          throw new Error("Joueur non inscrit à ce match");
        }
      }

      // La minute se déduit du temps écoulé depuis le coup d'envoi — sauf
      // sur une feuille saisie après coup, qui n'a pas d'horloge : le premier
      // but d'un match d'hier s'y serait inscrit à la 1 440e minute, et la
      // chronologie du récap l'aurait affiché tel quel.
      const ecoule = Date.now() - new Date(match.playedAt).getTime();
      const minute =
        input.minute !== undefined && input.minute !== null
          ? input.minute
          : ecoule < 0 || ecoule > RETRO_APRES_MS
            ? null
            : Math.max(0, Math.floor(ecoule / 60000));

      const event: LocalEvent = {
        id: eventId,
        matchId,
        type: input.type,
        team: input.team,
        playerId: input.playerId ?? null,
        assistPlayerId: input.assistPlayerId ?? null,
        minute,
        createdAt,
      };
      await db.events.put(event);

      const d = scoreDelta(input.type);
      if (d) {
        await db.matches.update(matchId, {
          scoreA: input.team === "A" ? match.scoreA + d : match.scoreA,
          scoreB: input.team === "B" ? match.scoreB + d : match.scoreB,
        });
      }

      await enqueue({
        kind: "addEvent",
        clubId: match.clubId,
        matchId,
        payload: {
          id: eventId,
          type: input.type,
          team: input.team,
          playerId: input.playerId ?? null,
          assistPlayerId: input.assistPlayerId ?? null,
          minute,
          createdAt,
        },
      });
    },
  );

  return eventId;
}

/// Annule un événement précis (tap sur la timeline).
export async function removeEvent(
  matchId: string,
  eventId: string,
): Promise<boolean> {
  const db = getDb();
  return db.transaction("rw", db.matches, db.events, db.outbox, async () => {
    const ev = await db.events.get(eventId);
    if (!ev || ev.matchId !== matchId) return false;
    await db.events.delete(eventId);

    const d = scoreDelta(ev.type);
    const match = await db.matches.get(matchId);
    if (d && match) {
      await db.matches.update(matchId, {
        scoreA: ev.team === "A" ? Math.max(0, match.scoreA - d) : match.scoreA,
        scoreB: ev.team === "B" ? Math.max(0, match.scoreB - d) : match.scoreB,
      });
    }

    await enqueue({
      kind: "removeEvent",
      clubId: match?.clubId ?? "",
      matchId,
      payload: { eventId },
    });
    return true;
  });
}

/// Attache (ou retire) une passe décisive à un but déjà saisi — le but part
/// instantanément au tap, la passe se choisit après sans bloquer la saisie.
export async function setEventAssist(
  matchId: string,
  eventId: string,
  assistPlayerId: string | null,
): Promise<boolean> {
  const db = getDb();
  let ecrit = true;
  await db.transaction("rw", db.matches, db.events, db.outbox, async () => {
    const ev = await db.events.get(eventId);
    if (!ev || ev.matchId !== matchId || ev.type !== "GOAL") {
      ecrit = false;
      return;
    }
    const match = await db.matches.get(matchId);
    await db.events.update(eventId, { assistPlayerId });
    await enqueue({
      kind: "setAssist",
      clubId: match?.clubId ?? "",
      matchId,
      payload: { eventId, assistPlayerId },
    });
  });
  return ecrit;
}

/// Désigne (ou retire) l'auteur d'un contre son camp déjà saisi.
///
/// Le csc est le seul but que personne ne revendique : sur le terrain, l'aveu
/// met dix secondes à venir et le nom fait débat. Le score, lui, est immédiat.
/// On écrit donc le but au premier tap avec un buteur nul, et on n'attache le
/// nom qu'après — par une mise à jour de champ, pour que l'événement garde son
/// identifiant et que la file hors-ligne reste rejouable.
export async function setEventScorer(
  matchId: string,
  eventId: string,
  scorerPlayerId: string | null,
): Promise<boolean> {
  const db = getDb();
  let ecrit = true;
  await db.transaction("rw", db.matches, db.events, db.outbox, async () => {
    const ev = await db.events.get(eventId);
    // L'événement a pu être annulé entre-temps depuis la chronologie. Sortir en
    // silence faisait croire à l'utilisateur que le nom avait été pris.
    if (!ev || ev.matchId !== matchId || ev.type !== "OWN_GOAL") {
      ecrit = false;
      return;
    }
    const match = await db.matches.get(matchId);
    await db.events.update(eventId, { playerId: scorerPlayerId });
    await enqueue({
      kind: "setScorer",
      clubId: match?.clubId ?? "",
      matchId,
      payload: { eventId, scorerPlayerId },
    });
  });
  return ecrit;
}

/// Fait changer un joueur de camp pendant le match.
///
/// L'erreur de composition se voit au coup d'envoi, pas avant : deux copains
/// dans la même équipe, un gardien manquant. Sans ce geste il fallait terminer
/// le match et tout ressaisir. Les buts déjà marqués gardent leur équipe
/// d'origine — ils ont bien été marqués pour ce camp-là.
export async function movePlayerTeam(
  matchId: string,
  playerId: string,
  team: "A" | "B",
): Promise<void> {
  const db = getDb();
  await db.transaction(
    "rw",
    db.matches,
    db.participants,
    db.outbox,
    async () => {
      const match = await db.matches.get(matchId);
      if (!match) throw new Error("Match introuvable");
      if (match.status === "FINISHED") throw new Error("Match terminé");
      // Sur un match contre un adversaire extérieur, l'équipe B n'est pas une
      // équipe du club : y envoyer un joueur le retire de l'écran sans retour.
      if (match.kind === "EXTERNAL" && team === "B") {
        throw new Error("Pas d'équipe B à composer sur ce match");
      }
      const part = await db.participants.get(pKey(matchId, playerId));
      if (!part) throw new Error("Joueur non inscrit à ce match");
      if (part.team === team) return; // déjà du bon côté
      // Un tap de trop en mode correction et la colonne d'origine se vide : le
      // match se terminait alors avec tout le monde du même côté, et
      // lib/stats.ts inscrivait une défaite à dix joueurs pour un match que
      // personne n'avait perdu.
      const restants = await db.participants
        .where("matchId")
        .equals(matchId)
        .filter((x) => x.team === part.team && x.playerId !== playerId)
        .count();
      if (restants === 0) {
        throw new Error("Il faut au moins un joueur de chaque côté");
      }
      await db.participants.update(pKey(matchId, playerId), { team });
      await enqueue({
        kind: "movePlayer",
        clubId: match.clubId,
        matchId,
        payload: { playerId, team },
      });
    },
  );
}

/// Inscrit un joueur arrivé après le coup d'envoi.
///
/// Le retardataire est une certitude dans un club qui joue tous les lundis. Il
/// n'avait aucune place : addEvent refusait ses buts (« Joueur non inscrit à ce
/// match ») et la seule issue était de terminer le match et de tout ressaisir.
export async function ajouterJoueurAuMatch(
  matchId: string,
  playerId: string,
  team: "A" | "B",
): Promise<void> {
  const db = getDb();
  await db.transaction(
    "rw",
    db.matches,
    db.participants,
    db.roster,
    db.outbox,
    async () => {
      const match = await db.matches.get(matchId);
      if (!match) throw new Error("Match introuvable");
      if (match.status === "FINISHED") throw new Error("Match terminé");
      const deja = await db.participants.get(pKey(matchId, playerId));
      if (deja) return; // déjà de la partie
      const fiche = await db.roster.get(playerId);
      // Il entre comme joueur de champ : le rôle de gardien d'un soir est une
      // décision distincte, qui se prend sur la compo de la soirée.
      await db.participants.put({
        key: pKey(matchId, playerId),
        matchId,
        playerId,
        team,
        isGk: false,
      });
      await enqueue({
        kind: "addParticipant",
        clubId: match.clubId,
        matchId,
        payload: {
          playerId,
          team,
          isGk: false,
          ...(fiche?.isGuest
            ? { guest: { id: fiche.id, name: fiche.name } }
            : {}),
        },
      });
    },
  );
}

/// Le vivier du club, hors des joueurs déjà inscrits à ce match — ceux qu'on
/// peut faire entrer en cours de route.
export async function joueursAbsentsDuMatch(
  matchId: string,
): Promise<{ id: string; name: string }[]> {
  const db = getDb();
  const match = await db.matches.get(matchId);
  if (!match) return [];
  const parts = await db.participants.where("matchId").equals(matchId).toArray();
  const dedans = new Set(parts.map((p) => p.playerId));
  const vivier = await db.roster.where("clubId").equals(match.clubId).toArray();
  return vivier
    .filter((p) => !dedans.has(p.id) && !p.isArchived)
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/// Annule le dernier but d'un joueur (geste rapide "−" sur sa tuile).
export async function undoLastGoalOf(
  matchId: string,
  playerId: string,
): Promise<string | null> {
  const db = getDb();
  const last = await db.events
    .where("[matchId+createdAt]")
    .between([matchId, Dexie.minKey], [matchId, Dexie.maxKey])
    .filter((e) => e.playerId === playerId && e.type === "GOAL")
    .last();
  if (!last) return null;
  const ok = await removeEvent(matchId, last.id);
  return ok ? last.id : null;
}

export async function finishMatch(
  matchId: string,
  mvpId: string | null,
  durationMin?: number | null,
): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.matches, db.outbox, async () => {
    const match = await db.matches.get(matchId);
    if (!match) throw new Error("Match introuvable");
    await db.matches.update(matchId, { status: "FINISHED", mvpId });
    await enqueue({
      kind: "finishMatch",
      clubId: match.clubId,
      matchId,
      payload: { mvpId, durationMin: durationMin ?? null },
    });
  });
}

// --- Sélecteurs ------------------------------------------------------------

export type LivePlayer = {
  id: string;
  name: string;
  photo?: string | null;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  isGk: boolean;
};

export async function getLocalMatch(matchId: string) {
  const db = getDb();
  const [match, parts, events] = await Promise.all([
    db.matches.get(matchId),
    db.participants.where("matchId").equals(matchId).toArray(),
    db.events.where("matchId").equals(matchId).sortBy("createdAt"),
  ]);
  if (!match) return null;

  const tally = new Map<
    string,
    { goals: number; assists: number; yellow: number; red: number }
  >();
  const bump = (
    id: string | null | undefined,
    key: "goals" | "assists" | "yellow" | "red",
  ) => {
    if (!id) return;
    const t = tally.get(id) ?? { goals: 0, assists: 0, yellow: 0, red: 0 };
    t[key]++;
    tally.set(id, t);
  };
  for (const e of events) {
    if (e.type === "GOAL") bump(e.playerId, "goals");
    if (e.type === "GOAL") bump(e.assistPlayerId, "assists");
    if (e.type === "YELLOW_CARD") bump(e.playerId, "yellow");
    if (e.type === "RED_CARD") bump(e.playerId, "red");
  }

  const ids = Array.from(new Set(parts.map((p) => p.playerId)));
  const roster = await db.roster.bulkGet(ids);
  const rosterById = new Map(roster.filter(Boolean).map((p) => [p!.id, p!]));

  const toLive = (team: "A" | "B"): LivePlayer[] =>
    parts
      .filter((p) => p.team === team)
      .map((p) => {
        const t = tally.get(p.playerId);
        return {
          id: p.playerId,
          name: rosterById.get(p.playerId)?.name ?? "?",
          photo: rosterById.get(p.playerId)?.photo ?? null,
          goals: t?.goals ?? 0,
          assists: t?.assists ?? 0,
          yellow: t?.yellow ?? 0,
          red: t?.red ?? 0,
          isGk: p.isGk,
        };
      });

  const enrichedEvents = events.map((e) => ({
    ...e,
    playerName: e.playerId ? (rosterById.get(e.playerId)?.name ?? "?") : null,
    assistName: e.assistPlayerId
      ? (rosterById.get(e.assistPlayerId)?.name ?? null)
      : null,
  }));

  return {
    match: match satisfies LocalMatch,
    teamA: toLive("A"),
    teamB: toLive("B"),
    events: enrichedEvents,
  };
}
