// La feuille de match dans la mémoire du téléphone : la faire descendre du
// serveur quand elle n'y est pas, l'en retirer quand on abandonne.
//
// lib/localMatch.ts écrit chaque geste ET l'enfile pour le serveur. Ici, rien
// ne part : ce qu'on recopie vient du serveur, et ce qu'on efface est une
// saisie qu'on renonce à envoyer.

import { getDb, type LocalEventType } from "@/lib/db";

type FeuilleServeur = {
  match: {
    id: string;
    clubId: string;
    status: "SCHEDULED" | "LIVE" | "FINISHED" | "CANCELED";
    kind: "INTERNAL" | "EXTERNAL";
    playedAt: string;
    matchDayId: string | null;
    seasonId: string | null;
    opponentId: string | null;
    teamAName: string;
    teamBName: string;
    scoreA: number;
    scoreB: number;
  };
  participants: {
    key: string;
    matchId: string;
    playerId: string;
    team: "A" | "B";
    isGk: boolean;
  }[];
  events: {
    id: string;
    matchId: string;
    type: LocalEventType;
    team: "A" | "B";
    playerId: string | null;
    assistPlayerId: string | null;
    minute: number | null;
    createdAt: string;
  }[];
};

export type Amorce = "amorcee" | "terminee" | "inconnue" | "injoignable";

/// Recopie depuis le serveur une feuille EN COURS lancée ailleurs.
///
/// « Terminer » menait à « Match introuvable » dès que la feuille avait été
/// ouverte sur un autre téléphone (ou dans l'app) : elle n'existait que dans
/// la mémoire de celui-là. Le deuxième qui prend la saisie, le téléphone à
/// plat à la mi-temps — c'est le cas du lundi soir, pas une exception.
export async function amorcerDepuisServeur(
  clubId: string,
  matchId: string,
): Promise<Amorce> {
  let res: Response;
  try {
    res = await fetch(
      `/api/clubs/${encodeURIComponent(clubId)}/matches/${encodeURIComponent(matchId)}`,
      { cache: "no-store" },
    );
  } catch {
    return "injoignable";
  }
  if (res.status === 404) return "inconnue";
  if (!res.ok) return "injoignable";
  const f = (await res.json()) as FeuilleServeur;
  if (f.match.status !== "LIVE") {
    return f.match.status === "FINISHED" ? "terminee" : "inconnue";
  }

  const db = getDb();
  await db.transaction("rw", db.matches, db.participants, db.events, async () => {
    // Écrite entre-temps par cet appareil : c'est elle qui fait foi.
    if (await db.matches.get(matchId)) return;
    await db.matches.put({
      id: f.match.id,
      clubId,
      matchDayId: f.match.matchDayId,
      seasonId: f.match.seasonId,
      kind: f.match.kind,
      opponentId: f.match.opponentId,
      playedAt: f.match.playedAt,
      teamAName: f.match.teamAName,
      teamBName: f.match.teamBName,
      scoreA: f.match.scoreA,
      scoreB: f.match.scoreB,
      status: "LIVE",
      mvpId: null,
      // Le chrono n'est pas au serveur : l'écran le repart de l'heure du coup
      // d'envoi. La mi-temps, elle, se lit dans les événements.
      period: f.events.some((e) => e.type === "HALF_TIME") ? 2 : 1,
    });
    await db.participants.bulkPut(
      f.participants.map((p) => ({
        key: p.key,
        matchId: p.matchId,
        playerId: p.playerId,
        team: p.team,
        isGk: p.isGk,
      })),
    );
    await db.events.bulkPut(f.events);
  });
  return "amorcee";
}

/// Vrai tant que le serveur n'a jamais reçu ce match : sa création attend
/// encore dans la file d'envoi de ce téléphone.
export async function creationEnAttente(matchId: string): Promise<boolean> {
  const db = getDb();
  const n = await db.outbox
    .filter((o) => o.op.matchId === matchId && o.op.kind === "createMatch")
    .count();
  return n > 0;
}

/// Retire le match de la mémoire du téléphone, file d'envoi comprise : rien
/// de ce qui a été saisi ne doit partir après l'abandon.
export async function oublierMatchLocal(matchId: string): Promise<void> {
  const db = getDb();
  await db.transaction(
    "rw",
    db.matches,
    db.participants,
    db.events,
    db.outbox,
    async () => {
      await db.outbox.filter((o) => o.op.matchId === matchId).delete();
      await db.events.where("matchId").equals(matchId).delete();
      await db.participants.where("matchId").equals(matchId).delete();
      await db.matches.delete(matchId);
    },
  );
}
