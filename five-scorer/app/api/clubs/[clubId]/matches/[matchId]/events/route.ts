import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { estId, estIdOuVide } from "@/lib/ids";
import type { MatchEventType, Team } from "@prisma/client";

type Ctx = { params: Promise<{ clubId: string; matchId: string }> };

const EVENT_TYPES: MatchEventType[] = [
  "GOAL",
  "OWN_GOAL",
  "YELLOW_CARD",
  "RED_CARD",
  "HALF_TIME",
];

async function recomputeScore(matchId: string) {
  const grouped = await prisma.matchEvent.groupBy({
    by: ["team"],
    where: { matchId, type: { in: ["GOAL", "OWN_GOAL"] } },
    _count: { _all: true },
  });
  const scoreA = grouped.find((g) => g.team === "A")?._count._all ?? 0;
  const scoreB = grouped.find((g) => g.team === "B")?._count._all ?? 0;
  await prisma.match.update({
    where: { id: matchId },
    data: { scoreA, scoreB },
  });
  return { scoreA, scoreB };
}

type PostBody = {
  id?: string;
  type: MatchEventType;
  team: "A" | "B";
  playerId?: string | null;
  assistPlayerId?: string | null;
  minute?: number | null;
  createdAt?: string;
};

export async function POST(req: Request, { params }: Ctx) {
  const { clubId, matchId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.canScore) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (
    !body ||
    !EVENT_TYPES.includes(body.type) ||
    (body.team !== "A" && body.team !== "B")
  ) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
  });
  if (!match) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }
  // Modifier un match terminé = correction rétroactive → admin.
  if (match.status === "FINISHED" && !ctx.canManage) {
    return NextResponse.json(
      { error: "Admin requis pour modifier un match terminé" },
      { status: 403 },
    );
  }

  // L'identifiant vient du client et part dans un `where` : sans ce contrôle,
  // un objet passe pour un filtre Prisma. `{ "id": { "not": null } }` faisait
  // correspondre n'importe quel événement du match, l'API répondait 200
  // « deduped » — et le but qu'on venait de taper n'était jamais écrit.
  if (body.id !== undefined && !estId(body.id)) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  // Idempotence : si l'ID client existe déjà, renvoyer l'état courant.
  if (body.id) {
    // findFirst scopé au match, et non findUnique par id : sinon un id
    // d'événement appartenant à un autre club renvoyait tout son contenu dans
    // la réponse, et la saisie réellement effectuée était perdue.
    const existing = await prisma.matchEvent.findFirst({
      where: { id: body.id, matchId },
    });
    if (existing) {
      const scores = await recomputeScore(matchId);
      return NextResponse.json({ event: existing, ...scores, deduped: true });
    }
  }

  // Les joueurs référencés doivent appartenir au club.
  if (!estIdOuVide(body.playerId) || !estIdOuVide(body.assistPlayerId)) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }
  const refs = [body.playerId, body.assistPlayerId].filter((x): x is string =>
    Boolean(x),
  );
  if (refs.length > 0) {
    const owned = await prisma.player.count({
      where: { id: { in: refs }, clubId },
    });
    if (owned !== new Set(refs).size) {
      return NextResponse.json(
        { error: "Joueur hors du club" },
        { status: 400 },
      );
    }
  }

  const event = await prisma.matchEvent.create({
    data: {
      ...(body.id ? { id: body.id } : {}),
      matchId,
      type: body.type,
      team: body.team as Team,
      playerId: body.playerId ?? null,
      assistPlayerId: body.assistPlayerId ?? null,
      minute: body.minute ?? null,
      ...(body.createdAt ? { createdAt: new Date(body.createdAt) } : {}),
    },
  });
  const scores = await recomputeScore(matchId);
  return NextResponse.json({ event, ...scores }, { status: 201 });
}

type PatchBody = {
  eventId: string;
  assistPlayerId?: string | null;
  /// Auteur d'un contre son camp, désigné après coup (cf. lib/localMatch.ts).
  scorerPlayerId?: string | null;
};

// PATCH : attache/retire la passe décisive d'un but, ou l'auteur d'un contre
// son camp (idempotent dans les deux cas).
export async function PATCH(req: Request, { params }: Ctx) {
  const { clubId, matchId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.canScore) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Le matchId vient de l'URL, entièrement contrôlée par l'appelant : sans ce
  // contrôle, un membre d'un club peut modifier les buts du match d'un autre
  // club. Le POST et le DELETE de ce fichier le faisaient déjà ; le PATCH
  // avait été oublié.
  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
    select: { status: true },
  });
  if (!match) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }
  if (match.status === "FINISHED" && !ctx.canManage) {
    return NextResponse.json(
      { error: "Admin requis pour modifier un match terminé" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body || !estId(body.eventId)) {
    return NextResponse.json({ error: "eventId requis" }, { status: 400 });
  }

  // Le corps désigne l'un OU l'autre : la présence de la clé fait foi, car
  // `null` est une valeur légitime (« retirer le nom »).
  const setsScorer = "scorerPlayerId" in body;
  const cible = setsScorer ? body.scorerPlayerId : body.assistPlayerId;
  if (!estIdOuVide(cible)) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }
  if (cible) {
    const owned = await prisma.player.count({ where: { id: cible, clubId } });
    if (!owned) {
      return NextResponse.json(
        { error: "Joueur hors du club" },
        { status: 400 },
      );
    }
  }

  // Idempotent : event déjà supprimé → 200 sans effet. Le type est contraint
  // dans le `where` pour qu'un csc ne puisse pas réécrire le buteur d'un but
  // normal, ni l'inverse.
  await prisma.matchEvent
    .update({
      where: setsScorer
        ? { id: body.eventId, matchId, type: "OWN_GOAL" }
        : { id: body.eventId, matchId, type: "GOAL" },
      data: setsScorer
        ? { playerId: cible ?? null }
        : { assistPlayerId: cible ?? null },
    })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}

// DELETE ?eventId=xxx → suppression idempotente (offline-first).
export async function DELETE(req: Request, { params }: Ctx) {
  const { clubId, matchId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.canScore) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
    select: { status: true },
  });
  if (!match) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }
  if (match.status === "FINISHED" && !ctx.canManage) {
    return NextResponse.json(
      { error: "Admin requis pour modifier un match terminé" },
      { status: 403 },
    );
  }

  const eventId = new URL(req.url).searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId requis" }, { status: 400 });
  }

  // Idempotent : déjà supprimé → 200 quand même.
  await prisma.matchEvent
    .delete({ where: { id: eventId, matchId } })
    .catch(() => null);
  const scores = await recomputeScore(matchId);
  return NextResponse.json({ removedEventId: eventId, ...scores });
}
