import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isUnlocked } from "@/lib/auth";
import type { Team } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

type PostBody = {
  scorerId: string;
  minute?: number;
};

async function recomputeScore(matchId: string) {
  const grouped = await prisma.goal.groupBy({
    by: ["team"],
    where: { matchId },
    _count: { _all: true },
  });
  const scoreA =
    grouped.find((g) => g.team === "A")?._count._all ?? 0;
  const scoreB =
    grouped.find((g) => g.team === "B")?._count._all ?? 0;
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
      matchId: id,
      scorerId,
      team: participation.team as Team,
      minute: body?.minute ?? null,
    },
    include: { scorer: true },
  });
  const scores = await recomputeScore(id);
  return NextResponse.json({ goal, ...scores }, { status: 201 });
}

// DELETE removes the last goal for a given scorer (undo). If no scorerId
// is provided, removes the very last goal of the match.
export async function DELETE(req: Request, { params }: Ctx) {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const url = new URL(req.url);
  const scorerId = url.searchParams.get("scorerId") ?? undefined;

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
