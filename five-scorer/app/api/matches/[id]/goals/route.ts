import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin, isUnlocked } from "@/lib/auth";
import type { Team } from "@prisma/client";

// Helper: does mutating this match require admin?
async function requiresAdmin(matchId: string): Promise<boolean> {
  const m = await prisma.match.findUnique({
    where: { id: matchId },
    select: { status: true },
  });
  return m?.status === "FINISHED";
}

type Ctx = { params: Promise<{ id: string }> };

type PostBody = {
  id?: string;
  scorerId: string;
  assistId?: string | null;
  team?: "A" | "B";
  minute?: number;
  createdAt?: string;
};

type PatchBody = {
  goalId: string;
  assistId: string | null;
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
  // Retroactive goal add on a finished match requires admin.
  if (await requiresAdmin(id)) {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { error: "Admin requis pour ajouter un but à un match terminé" },
        { status: 403 }
      );
    }
  }
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
      assistId: body?.assistId ?? null,
      team: participation.team as Team,
      minute: body?.minute ?? null,
      ...(body?.createdAt ? { createdAt: new Date(body.createdAt) } : {}),
    },
    include: { scorer: true, assist: true },
  });
  const scores = await recomputeScore(id);
  return NextResponse.json({ goal, ...scores }, { status: 201 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (await requiresAdmin(id)) {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { error: "Admin requis pour éditer un but d'un match terminé" },
        { status: 403 }
      );
    }
  }
  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body?.goalId) {
    return NextResponse.json({ error: "goalId requis" }, { status: 400 });
  }

  await prisma.goal
    .update({
      where: { id: body.goalId, matchId: id },
      data: { assistId: body.assistId ?? null },
    })
    .catch(() => null); // idempotent
  return NextResponse.json({ goalId: body.goalId, assistId: body.assistId });
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
  if (await requiresAdmin(id)) {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { error: "Admin requis pour supprimer un but d'un match terminé" },
        { status: 403 }
      );
    }
  }
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
