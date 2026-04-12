import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isUnlocked } from "@/lib/auth";

export async function GET() {
  const players = await prisma.player.findMany({
    orderBy: [{ isGuest: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ players });
}

export async function POST(req: Request) {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { name?: string; isGuest?: boolean }
    | null;
  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  }
  const player = await prisma.player.create({
    data: { name, isGuest: Boolean(body?.isGuest) },
  });
  return NextResponse.json({ player }, { status: 201 });
}
