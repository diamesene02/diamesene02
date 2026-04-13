import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isUnlocked } from "@/lib/auth";
import type { Team } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

type PostBody = {
  id?: string; // client-generated goal ID (offline-first)
  scorerId: string;
  minute?: number;
  createdAt?: string; // ISO, preserves order when synced from outbox
};

async function recomputeScore(matchId: string) {
  const grouped = await prisma.goal.groupBy({
    by: ["team"],
    where: { matchId },
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

export async function POST(req: Request, { params }: Ctx) {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as PostBody | null;
  const scorerId = body?.scorerId;
  if (!scorerId) {
    return NextResponse.json({ error: "scorerId requis" }, { status: 400 });
  }

  // If a client-provided goal ID already exists, just return current state —
  // this makes the endpoint safe to retry from the sync outbox.
  if (body?.id) {
    const existing = await prisma.goal.findUnique({
      where: { id: body.id },
      include: { scorer: true },
    });
    if (existing) {
      const scores = await recomputeScore(id);
      return NextResponse.json({ goal: existing, ...scores, deduped: true });
    }
  }

  const participation = await prisma.matchPlayer.findUnique({
    where: { matchId_playerId: { matchId: id, playerId: scorerId } },
  });
  if (!participation) {
    return NextResponse.json(
      { error: "Joueur non inscrit à ce match" },
      { status: 400 }
    );
  }

  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }
  if (match.status === "FINISHED") {
    return NextResponse.json({ error: "Match terminé" }, { status: 400 });
  }

  const goal = await prisma.goal.create({
    data: {
      ...(body?.id ? { id: body.id } : {}),
      matchId: id,
      scorerId,
      team: participation.team as Team,
      minute: body?.minute ?? null,
      ...(body?.createdAt ? { createdAt: new Date(body.createdAt) } : {}),
    },
    include: { scorer: true },
  });
  const scores = await recomputeScore(id);
  return NextResponse.json({ goal, ...scores }, { status: 201 });
}

// DELETE:
//   - ?goalId=xxx  → idempotent removal of that specific goal (offline-first)
//   - ?scorerId=x  → removes the last goal of that scorer (undo button)
//   - (no param)   → removes the very last goal of the match
export async function DELETE(req: Request, { params }: Ctx) {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const url = new URL(req.url);
  const goalId = url.searchParams.get("goalId") ?? undefined;
  const scorerId = url.searchParams.get("scorerId") ?? undefined;

  if (goalId) {
    // Idempotent: if already gone, still 200.
    await prisma.goal
      .delete({ where: { id: goalId, matchId: id } })
      .catch(() => null);
    const scores = await recomputeScore(id);
    return NextResponse.json({ removedGoalId: goalId, ...scores });
  }

  const last = await prisma.goal.findFirst({
    where: { matchId: id, ...(scorerId ? { scorerId } : {}) },
    orderBy: { createdAt: "desc" },
  });
  if (!last) {
    return NextResponse.json({ error: "Aucun but à annuler" }, { status: 404 });
  }
  await prisma.goal.delete({ where: { id: last.id } });
  const scores = await recomputeScore(id);
  return NextResponse.json({ removedGoalId: last.id, ...scores });
}
