import { NextResponse } from "next/server";
import { getClubApiContext } from "@/lib/guard";
import {
  creerEvenementMatch,
  modifierEvenementMatch,
  supprimerEvenementMatch,
} from "@/lib/matchEvents";
import type { MatchEventType } from "@prisma/client";

// Les trois gestes vivent dans lib/matchEvents.ts, partagés avec l'écran
// /corriger du site (spec 0001) : cette route ne fait plus que lire la
// requête et traduire le résultat en réponse HTTP. Les codes, les messages
// et la forme du JSON sont ceux qu'attend l'app mobile, inchangés.

type Ctx = { params: Promise<{ clubId: string; matchId: string }> };

const EVENT_TYPES: MatchEventType[] = [
  "GOAL",
  "OWN_GOAL",
  "YELLOW_CARD",
  "RED_CARD",
  "HALF_TIME",
];

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

  const res = await creerEvenementMatch({
    clubId,
    matchId,
    canManage: ctx.canManage,
    userId: ctx.user.id,
    id: body.id,
    type: body.type,
    team: body.team,
    playerId: body.playerId,
    assistPlayerId: body.assistPlayerId,
    minute: body.minute,
    createdAt: body.createdAt,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  if (res.deduped) {
    return NextResponse.json({ event: res.event, scoreA: res.scoreA, scoreB: res.scoreB, deduped: true });
  }
  return NextResponse.json(
    { event: res.event, scoreA: res.scoreA, scoreB: res.scoreB },
    { status: 201 },
  );
}

type PatchBody = {
  eventId: string;
  assistPlayerId?: string | null;
  /// Auteur d'un contre son camp, désigné après coup (cf. lib/localMatch.ts).
  scorerPlayerId?: string | null;
};

// PATCH : attache/retire la passe décisive d'un but, ou l'auteur d'un contre
// son camp (idempotent dans les deux cas). Le corps désigne l'un OU l'autre :
// la présence de la clé fait foi, car `null` est une valeur légitime.
export async function PATCH(req: Request, { params }: Ctx) {
  const { clubId, matchId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.canScore) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  const setsScorer = !!body && "scorerPlayerId" in body;
  const res = await modifierEvenementMatch({
    clubId,
    matchId,
    canManage: ctx.canManage,
    userId: ctx.user.id,
    eventId: body?.eventId ?? "",
    setsScorer,
    scorerPlayerId: body?.scorerPlayerId,
    assistPlayerId: body?.assistPlayerId,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
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

  const res = await supprimerEvenementMatch({
    clubId,
    matchId,
    canManage: ctx.canManage,
    userId: ctx.user.id,
    eventId: new URL(req.url).searchParams.get("eventId"),
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({
    removedEventId: res.removedEventId,
    scoreA: res.scoreA,
    scoreB: res.scoreB,
  });
}
