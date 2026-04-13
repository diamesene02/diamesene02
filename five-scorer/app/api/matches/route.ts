import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isUnlocked } from "@/lib/auth";

export async function GET() {
  const matches = await prisma.match.findMany({
    orderBy: { playedAt: "desc" },
    include: {
      mvp: true,
      players: { include: { player: true } },
    },
    take: 50,
  });
  return NextResponse.json({ matches });
}

type CreateBody = {
  id?: string;
  playedAt?: string; // ISO
  teamAName?: string;
  teamBName?: string;
  teamA: string[]; // player IDs
  teamB: string[]; // player IDs
};

export async function POST(req: Request) {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body || !Array.isArray(body.teamA) || !Array.isArray(body.teamB)) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }
  const all = [...body.teamA, ...body.teamB];
  if (all.length === 0) {
    return NextResponse.json({ error: "Aucun joueur" }, { status: 400 });
  }
  if (new Set(all).size !== all.length) {
    return NextResponse.json(
      { error: "Un joueur ne peut pas être dans les deux équipes" },
      { status: 400 }
    );
  }

  const teamAName = body.teamAName?.trim() || "Équipe A";
  const teamBName = body.teamBName?.trim() || "Équipe B";
  const playedAt = body.playedAt ? new Date(body.playedAt) : undefined;

  // Upsert match (idempotent — safe to retry from an offline outbox).
  const match = await prisma.$transaction(async (tx) => {
    const upserted = body.id
      ? await tx.match.upsert({
          where: { id: body.id },
          create: {
            id: body.id,
            teamAName,
            teamBName,
            ...(playedAt ? { playedAt } : {}),
          },
          update: { teamAName, teamBName },
        })
      : await tx.match.create({
          data: {
            teamAName,
            teamBName,
            ...(playedAt ? { playedAt } : {}),
          },
        });

    // Reset compos (idempotent).
    await tx.matchPlayer.deleteMany({ where: { matchId: upserted.id } });
    await tx.matchPlayer.createMany({
      data: [
        ...body.teamA.map((playerId) => ({
          matchId: upserted.id,
          playerId,
          team: "A" as const,
        })),
        ...body.teamB.map((playerId) => ({
          matchId: upserted.id,
          playerId,
          team: "B" as const,
        })),
      ],
    });

    return tx.match.findUnique({
      where: { id: upserted.id },
      include: { players: { include: { player: true } } },
    });
  });

  return NextResponse.json({ match }, { status: 201 });
}
