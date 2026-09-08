import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";

// Roster du club — utilisé pour rafraîchir le cache offline (Dexie).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const players = await prisma.player.findMany({
    where: { clubId, isArchived: false },
    orderBy: [{ isGuest: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      nickname: true,
      photo: true,
      skill: true,
      isGk: true,
      isGuest: true,
    },
  });
  return NextResponse.json({ players });
}
