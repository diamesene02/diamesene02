import { NextResponse } from "next/server";
import { getSession, verifyPin } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { pin?: string } | null;
  const pin = body?.pin?.trim();
  if (!pin) {
    return NextResponse.json({ error: "PIN manquant" }, { status: 400 });
  }
  if (!verifyPin(pin)) {
    return NextResponse.json({ error: "PIN invalide" }, { status: 401 });
  }
  const session = await getSession();
  session.unlocked = true;
  session.unlockedAt = Date.now();
  await session.save();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
