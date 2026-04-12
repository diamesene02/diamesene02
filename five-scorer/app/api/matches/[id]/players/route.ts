import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isUnlocked } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

type PostBody = {
  // Either attach an existing player...
  playerId?: string;
  // ...or create a guest on the fly
  name?: string;
  isGuest?: boolean;
  team: "A" | "B";
};

export async function POST(req: Request, { params }: Ctx) {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body || (body.team !== "A" && body.team !== "B")) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  let playerId = body.playerId;
  if (!playerId) {
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "playerId ou name requis" },
        { status: 400 }
      );
    }
    const created = await prisma.player.create({
      data: { name, isGuest: body.isGuest ?? true },
    });
    playerId = created.id;
  }

  const participation = await prisma.matchPlayer.upsert({
    where: { matchId_playerId: { matchId: id, playerId } },
    update: { team: body.team },
    create: { matchId: id, playerId, team: body.team },
    include: { player: true },
  });

  return NextResponse.json({ participation }, { status: 201 });
}
