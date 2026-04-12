import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isUnlocked } from "@/lib/auth";

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
  const match = await prisma.match.update({
    where: { id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.mvpId !== undefined ? { mvpId: body.mvpId } : {}),
      ...(body.teamAName ? { teamAName: body.teamAName } : {}),
      ...(body.teamBName ? { teamBName: body.teamBName } : {}),
    },
  });
  return NextResponse.json({ match });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.match.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
