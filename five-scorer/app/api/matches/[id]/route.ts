import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin, isUnlocked } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      mvp: true,
      players: { include: { player: true } },
      goals: {
        include: { scorer: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!match) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }
  return NextResponse.json({ match });
}

type PatchBody = {
  status?: "LIVE" | "FINISHED";
  mvpId?: string | null;
  teamAName?: string;
  teamBName?: string;
  // Optional bulk-override scores (will also trigger a recompute when goals edited separately)
  scoreA?: number;
  scoreB?: number;
};

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  // Admin-only guard: editing a FINISHED match (score override, mvp change,
  // team rename, reopening) requires the admin role. Finishing a LIVE match
  // from the mobile scorer uses status: "FINISHED" only — that's allowed for
  // the scorer.
  const existing = await prisma.match.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }

  const isReopen = body.status === "LIVE";
  const isEditOnFinished =
    existing.status === "FINISHED" &&
    (body.teamAName !== undefined ||
      body.teamBName !== undefined ||
      body.scoreA !== undefined ||
      body.scoreB !== undefined ||
      body.mvpId !== undefined);

  if (isReopen || isEditOnFinished) {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { error: "Admin requis pour modifier un match terminé" },
        { status: 403 }
      );
    }
  }

  const match = await prisma.match.update({
    where: { id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.mvpId !== undefined ? { mvpId: body.mvpId } : {}),
      ...(body.teamAName ? { teamAName: body.teamAName } : {}),
      ...(body.teamBName ? { teamBName: body.teamBName } : {}),
      ...(body.scoreA !== undefined ? { scoreA: body.scoreA } : {}),
      ...(body.scoreB !== undefined ? { scoreB: body.scoreB } : {}),
    },
  });
  return NextResponse.json({ match });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  // Deletion always requires admin — never exposed to the scorer role.
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "Admin requis pour supprimer un match" },
      { status: 403 }
    );
  }
  const { id } = await params;
  await prisma.match.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
