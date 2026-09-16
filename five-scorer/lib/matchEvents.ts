import { prisma } from "@/lib/prisma";
import type { MatchEvent, MatchEventType, Team } from "@prisma/client";
import { matchVerrouille, joueursValidesPourEvenement } from "@/lib/matches";
import { estId, estIdOuVide } from "@/lib/ids";

// Écritures sur les événements d'un match (but, csc, carton…) — extraites de
// `app/api/clubs/[clubId]/matches/[matchId]/events/route.ts` pour être
// appelables aussi bien depuis cette route (déjà en prod, appelée par l'app
// mobile) que depuis un futur écran serveur `/corriger` (spec 0001). Chaque
// fonction reproduit EXACTEMENT la garde, l'écriture et les effets de bord du
// handler dont elle vient — la route ne fait plus que parser la requête et
// traduire le résultat en réponse HTTP.
//
// Le marquage correctedAt/correctedById (Match.correctedAt, spec 0001) est
// pesé UNE fois ici : matchVerrouille(match.status) est vrai (le match est
// FINISHED ou CANCELED) implique — par construction, la garde ci-dessous a
// déjà refusé l'écriture sinon — que l'auteur est admin ET que le match est
// FINISHED (un CANCELED n'arrive jamais jusqu'à l'écriture). C'est exactement
// la condition qui distingue une correction rétroactive d'une saisie normale.

const ADMIN_REQUIS = "Admin requis pour modifier un match terminé ou annulé";
export const MATCH_ANNULE = "Un match annulé ne se corrige pas : rétablis-le d'abord.";

/// La garde d'écriture, la même pour les cinq gestes de ce fichier.
///
/// Un match verrouillé (FINISHED ou CANCELED) n'accepte qu'un admin : c'est
/// une correction. Un match ANNULÉ n'en accepte aucune, admin compris — on le
/// rétablit d'abord, puis on corrige (spec 0001). Cette seconde règle vivait
/// dans l'écran /corriger seulement ; le 16 septembre 2026, le parcours de
/// lecture a montré l'API laissant un admin pousser un but dans un match
/// annulé (201), but qui comptait dès le rétablissement. Une règle tenue par
/// l'affichage n'est pas une règle (constitution, article III) : elle est ici.
/// Le 409 est un refus définitif pour la file hors-ligne, avec sa raison —
/// un téléphone qui rejoue ses buts sur un match annulé entre-temps lit
/// pourquoi, et « Réessayer » aboutit une fois le match rétabli.
function refusEcriture(
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "CANCELED",
  canManage: boolean,
): { ok: false; status: number; error: string } | null {
  if (!matchVerrouille(status)) return null;
  if (!canManage) return { ok: false, status: 403, error: ADMIN_REQUIS };
  if (status === "CANCELED") return { ok: false, status: 409, error: MATCH_ANNULE };
  return null;
}

/// Pose la marque de correction sur le match — qui, et quand (APRES-13).
/// Toujours en plus d'une écriture qui vient d'avoir lieu, jamais seule.
export async function marquerCorrection(matchId: string, userId: string) {
  await prisma.match.update({
    where: { id: matchId },
    data: { correctedAt: new Date(), correctedById: userId },
  });
}

/// Recalcule scoreA/scoreB depuis les événements GOAL/OWN_GOAL et les repose
/// sur le Match. `correctionUserId`, quand fourni, pose correctedAt/
/// correctedById dans la MÊME écriture Prisma — jamais une deuxième requête.
export async function recomputeScore(matchId: string, correctionUserId?: string) {
  const grouped = await prisma.matchEvent.groupBy({
    by: ["team"],
    where: { matchId, type: { in: ["GOAL", "OWN_GOAL"] } },
    _count: { _all: true },
  });
  const scoreA = grouped.find((g) => g.team === "A")?._count._all ?? 0;
  const scoreB = grouped.find((g) => g.team === "B")?._count._all ?? 0;
  await prisma.match.update({
    where: { id: matchId },
    data: {
      scoreA,
      scoreB,
      ...(correctionUserId
        ? { correctedAt: new Date(), correctedById: correctionUserId }
        : {}),
    },
  });
  return { scoreA, scoreB };
}

export type ResultatEvenement =
  | {
      ok: true;
      status: 200 | 201;
      event: MatchEvent;
      scoreA: number;
      scoreB: number;
      deduped?: true;
    }
  | { ok: false; status: number; error: string };

/// POST events/route.ts — crée un événement (idempotent par id).
export async function creerEvenementMatch(input: {
  clubId: string;
  matchId: string;
  canManage: boolean;
  userId: string;
  id?: string;
  type: MatchEventType;
  team: Team;
  playerId?: string | null;
  assistPlayerId?: string | null;
  minute?: number | null;
  createdAt?: string;
}): Promise<ResultatEvenement> {
  const { clubId, matchId, canManage, userId } = input;

  const match = await prisma.match.findFirst({ where: { id: matchId, clubId } });
  if (!match) return { ok: false, status: 404, error: "Match introuvable" };
  // Modifier un match terminé = correction rétroactive → admin.
  const refus = refusEcriture(match.status, canManage);
  if (refus) return refus;
  const correction = matchVerrouille(match.status);

  // L'identifiant vient du client et part dans un `where` : sans ce contrôle,
  // un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (input.id !== undefined && !estId(input.id)) {
    return { ok: false, status: 400, error: "Identifiant invalide" };
  }

  // Idempotence : si l'ID client existe déjà, renvoyer l'état courant.
  if (input.id) {
    const existing = await prisma.matchEvent.findFirst({
      where: { id: input.id, matchId },
    });
    if (existing) {
      const scores = await recomputeScore(matchId);
      return { ok: true, status: 200, event: existing, ...scores, deduped: true };
    }
  }

  // Les joueurs référencés doivent appartenir au club et, sur un match
  // INTERNAL, être sur SA feuille (spec 0001, Q6 — cf. lib/matches.ts).
  if (!estIdOuVide(input.playerId) || !estIdOuVide(input.assistPlayerId)) {
    return { ok: false, status: 400, error: "Identifiant invalide" };
  }
  const refs = [input.playerId, input.assistPlayerId].filter((x): x is string =>
    Boolean(x),
  );
  const refsOk = await joueursValidesPourEvenement(matchId, clubId, match.kind, refs);
  if (!refsOk.ok) return { ok: false, status: 400, error: refsOk.error };

  const event = await prisma.matchEvent.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      matchId,
      type: input.type,
      team: input.team,
      playerId: input.playerId ?? null,
      assistPlayerId: input.assistPlayerId ?? null,
      minute: input.minute ?? null,
      ...(input.createdAt ? { createdAt: new Date(input.createdAt) } : {}),
    },
  });
  const scores = await recomputeScore(matchId, correction ? userId : undefined);
  return { ok: true, status: 201, event, ...scores };
}

export type ResultatModifierEvenement =
  | { ok: true }
  | { ok: false; status: number; error: string };

/// PATCH events/route.ts — attache/retire la passe décisive d'un but, ou
/// l'auteur d'un contre son camp (idempotent dans les deux cas). La présence
/// de la clé fait foi (`setsScorer`) : `null` est une valeur légitime
/// (« retirer le nom »), c'est pourquoi le champ ciblé n'est jamais déduit de
/// sa seule valeur.
export async function modifierEvenementMatch(input: {
  clubId: string;
  matchId: string;
  canManage: boolean;
  userId: string;
  eventId: string;
  setsScorer: boolean;
  scorerPlayerId?: string | null;
  assistPlayerId?: string | null;
}): Promise<ResultatModifierEvenement> {
  const { clubId, matchId, canManage, userId, setsScorer } = input;

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
    select: { status: true, kind: true },
  });
  if (!match) return { ok: false, status: 404, error: "Match introuvable" };
  const refus = refusEcriture(match.status, canManage);
  if (refus) return refus;

  if (!estId(input.eventId)) {
    return { ok: false, status: 400, error: "eventId requis" };
  }

  const cible = setsScorer ? input.scorerPlayerId : input.assistPlayerId;
  if (!estIdOuVide(cible)) {
    return { ok: false, status: 400, error: "Identifiant invalide" };
  }
  if (cible) {
    const cibleOk = await joueursValidesPourEvenement(matchId, clubId, match.kind, [
      cible,
    ]);
    if (!cibleOk.ok) return { ok: false, status: 400, error: cibleOk.error };
  }

  // Idempotent : event déjà supprimé → pas d'effet. Le type est contraint
  // dans le `where` pour qu'un csc ne puisse pas réécrire le buteur d'un but
  // normal, ni l'inverse.
  await prisma.matchEvent
    .update({
      where: setsScorer
        ? { id: input.eventId, matchId, type: "OWN_GOAL" }
        : { id: input.eventId, matchId, type: "GOAL" },
      data: setsScorer ? { playerId: cible ?? null } : { assistPlayerId: cible ?? null },
    })
    .catch(() => null);

  if (matchVerrouille(match.status)) await marquerCorrection(matchId, userId);

  return { ok: true };
}

export type ResultatSupprimerEvenement =
  | { ok: true; removedEventId: string; scoreA: number; scoreB: number }
  | { ok: false; status: number; error: string };

/// DELETE events/route.ts — suppression idempotente (offline-first).
export async function supprimerEvenementMatch(input: {
  clubId: string;
  matchId: string;
  canManage: boolean;
  userId: string;
  eventId: string | null;
}): Promise<ResultatSupprimerEvenement> {
  const { clubId, matchId, canManage, userId } = input;

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
    select: { status: true },
  });
  if (!match) return { ok: false, status: 404, error: "Match introuvable" };
  const refus = refusEcriture(match.status, canManage);
  if (refus) return refus;

  if (!input.eventId) {
    return { ok: false, status: 400, error: "eventId requis" };
  }

  // Idempotent : déjà supprimé → succès quand même.
  await prisma.matchEvent
    .delete({ where: { id: input.eventId, matchId } })
    .catch(() => null);
  const scores = await recomputeScore(
    matchId,
    matchVerrouille(match.status) ? userId : undefined,
  );
  return { ok: true, removedEventId: input.eventId, ...scores };
}

export type ResultatCompo =
  | { ok: true; applique: boolean }
  | { ok: false; status: number; error: string };

const HORS_ADVERSAIRE = "Pas d'équipe B à composer sur un match contre un adversaire";

/// PATCH lineup/route.ts — fait changer un joueur de camp.
///
/// L'écriture est absolue (« ce joueur est dans l'équipe X »), pas
/// incrémentale : la file hors-ligne peut la rejouer sans faire osciller la
/// compo. Tant que RIEN n'a été saisi dans le match, corriger la composition
/// corrige aussi l'équipe de départ ; au premier événement, elle se fige.
/// Un joueur absent de la feuille n'est pas un refus (`applique: false`) :
/// un 4xx bloquerait toute la chaîne d'opérations du match dans la file.
export async function deplacerJoueurMatch(input: {
  clubId: string;
  matchId: string;
  canManage: boolean;
  userId: string;
  playerId: string;
  team: Team;
}): Promise<ResultatCompo> {
  const { clubId, matchId, canManage, userId, playerId, team } = input;
  if (!estId(playerId)) return { ok: false, status: 400, error: "playerId requis" };

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
    select: { status: true, kind: true },
  });
  if (!match) return { ok: false, status: 404, error: "Match introuvable" };
  const refus = refusEcriture(match.status, canManage);
  if (refus) return refus;
  // L'équipe B d'un match EXTERNAL est l'adversaire, pas une équipe du club.
  if (match.kind === "EXTERNAL" && team === "B") {
    return { ok: false, status: 400, error: HORS_ADVERSAIRE };
  }

  const dejaSaisi = await prisma.matchEvent.count({ where: { matchId } });
  const corrigeDepart = dejaSaisi === 0;
  const updated = await prisma.matchParticipant.updateMany({
    where: { matchId, playerId },
    data: corrigeDepart ? { team, initialTeam: team } : { team },
  });
  if (updated.count > 0 && matchVerrouille(match.status)) {
    await marquerCorrection(matchId, userId);
  }
  return { ok: true, applique: updated.count > 0 };
}

/// POST lineup/route.ts — inscrit un joueur arrivé après le coup d'envoi.
///
/// Idempotent : rejouer ne crée pas de doublon et ne réécrit pas l'équipe
/// d'un joueur déjà inscrit. Un invité créé hors ligne est créé côté serveur
/// avant, exactement comme à la création du match.
export async function inscrireJoueurMatch(input: {
  clubId: string;
  matchId: string;
  canManage: boolean;
  userId: string;
  playerId: string;
  team: Team;
  isGk?: boolean;
  guest?: { id: string; name: string };
}): Promise<ResultatCompo> {
  const { clubId, matchId, canManage, userId, playerId, team } = input;
  if (!estId(playerId)) return { ok: false, status: 400, error: "playerId requis" };

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
    select: { status: true, kind: true },
  });
  if (!match) return { ok: false, status: 404, error: "Match introuvable" };
  const refus = refusEcriture(match.status, canManage);
  if (refus) return refus;
  if (match.kind === "EXTERNAL" && team === "B") {
    return { ok: false, status: 400, error: HORS_ADVERSAIRE };
  }

  if (input.guest && input.guest.id === playerId) {
    if (!estId(input.guest.id)) return { ok: false, status: 400, error: "Invité invalide" };
    await prisma.player.upsert({
      where: { id: input.guest.id },
      create: {
        id: input.guest.id,
        clubId,
        name: input.guest.name.trim().slice(0, 60) || "Invité",
        isGuest: true,
      },
      update: {},
    });
  }

  const aNous = await prisma.player.count({ where: { id: playerId, clubId } });
  if (!aNous) return { ok: false, status: 400, error: "Joueur hors du club" };

  // Le joueur arrivé en cours de match a pour équipe de départ celle où il
  // entre : c'est bien le résultat de ce camp qui doit lui être compté.
  const created = await prisma.matchParticipant.createMany({
    data: [{ matchId, playerId, team, initialTeam: team, isGk: Boolean(input.isGk) }],
    skipDuplicates: true,
  });
  if (created.count > 0 && matchVerrouille(match.status)) {
    await marquerCorrection(matchId, userId);
  }
  return { ok: true, applique: created.count > 0 };
}
