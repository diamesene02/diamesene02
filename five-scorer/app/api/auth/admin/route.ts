import { NextResponse } from "next/server";
import { getSession, verifyAdminPin } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { pin?: string } | null;
  const pin = body?.pin?.trim();
  if (!pin) {
    return NextResponse.json({ error: "PIN manquant" }, { status: 400 });
  }
  if (!verifyAdminPin(pin)) {
    return NextResponse.json({ error: "PIN admin invalide" }, { status: 401 });
  }
  const session = await getSession();
  session.admin = true;
  session.adminAt = Date.now();
  await session.save();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  session.admin = false;
  session.adminAt = undefined;
  await session.save();
  return NextResponse.json({ ok: true });
}
